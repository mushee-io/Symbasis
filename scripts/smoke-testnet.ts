import { ethers } from "hardhat";
import fs from "node:fs";
import path from "node:path";

const EXPECTED_CHAIN_ID = 2651420n;
const STORK_API = "https://rest.jp.stork-oracle.network/v1/prices/latest";
const ASSET = "ETHUSD";
const ZERO32 = ethers.ZeroHash;

type Deployment = {
  oracleMode?: "demo" | "stork";
  feeds: { ETHUSD: string; BTCUSD: string };
  contracts: {
    mockUSDC: string;
    vault: string;
    marketRegistry: string;
    oracle?: string;
    storkOracleAdapter: string;
    perpEngine: string;
    confidentialIntentRegistry: string;
  };
};

function parseSignedPayload(rawText: string) {
  const safeText = rawText.replace(/:(\s*)(-?\d{16,})([,}\]])/g, `:$1"$2"$3`);
  const body = JSON.parse(safeText);
  const signed = body?.data?.[ASSET]?.stork_signed_price;
  const signature = signed?.timestamped_signature?.signature;
  if (!signed || !signature) throw new Error(`Stork did not return a signed ${ASSET} price`);
  const checksum = String(signed.calculation_alg?.checksum ?? "");
  return [{
    temporalNumericValue: {
      timestampNs: BigInt(String(signed.timestamped_signature.timestamp)),
      quantizedValue: BigInt(String(signed.price))
    },
    id: signed.encoded_asset_id,
    publisherMerkleRoot: signed.publisher_merkle_root,
    valueComputeAlgHash: checksum.startsWith("0x") ? checksum : `0x${checksum}`,
    r: signature.r,
    s: signature.s,
    v: Number(signature.v)
  }];
}

async function fetchStorkUpdate(apiKey: string) {
  const response = await fetch(`${STORK_API}?assets=${ASSET}`, {
    headers: { Authorization: `Basic ${apiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`Stork API failed with HTTP ${response.status}`);
  const raw = await response.text();
  if (!raw || raw.length > 1_000_000) throw new Error("Invalid Stork response size");
  return parseSignedPayload(raw);
}

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) throw new Error(`Wrong chain ${network.chainId}`);

  const [trader] = await ethers.getSigners();
  if (!trader) throw new Error("No trader/deployer signer configured");
  if ((await ethers.provider.getBalance(trader.address)) === 0n) throw new Error("Trader has no testnet ETH for gas");

  const deploymentPath = path.join(process.cwd(), "deployments", "horizen-testnet.json");
  if (!fs.existsSync(deploymentPath)) throw new Error("Deployment artifact missing");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as Deployment;
  const oracleMode = deployment.oracleMode ?? "stork";
  const c = deployment.contracts;
  const oracleAddress = c.oracle ?? c.storkOracleAdapter;

  const token = await ethers.getContractAt("MockUSDC", c.mockUSDC, trader);
  const vault = await ethers.getContractAt("SymbasisVault", c.vault, trader);
  const oracle: any = await ethers.getContractAt(oracleMode === "demo" ? "DemoPriceOracle" : "StorkOracleAdapter", oracleAddress, trader);
  const engine = await ethers.getContractAt("PerpEngine", c.perpEngine, trader);
  const intents = await ethers.getContractAt("ConfidentialIntentRegistry", c.confidentialIntentRegistry, trader);
  const registry = await ethers.getContractAt("MarketRegistry", c.marketRegistry, trader);

  const marketId = ethers.id("ETH-PERP");
  const market = await registry.getMarket(marketId);
  const existing = await engine.positions(trader.address, marketId);
  if (existing.sizeUsd !== 0n) throw new Error("Smoke-test trader already has an ETH-PERP position; use a clean deployer wallet");

  const depositTarget = ethers.parseUnits("1000", 6);
  const margin = ethers.parseUnits("100", 6);
  const walletBalance = await token.balanceOf(trader.address);
  if (walletBalance < depositTarget) {
    const mintTx = await token.mint(trader.address, depositTarget - walletBalance);
    await mintTx.wait();
  }

  const txs: Record<string, string> = {};
  const allowance = await token.allowance(trader.address, c.vault);
  if (allowance < depositTarget) {
    const approveTx = await token.approve(c.vault, ethers.MaxUint256);
    await approveTx.wait();
    txs.approve = approveTx.hash;
  }

  const beforeCollateral = await vault.collateral(trader.address);
  if (beforeCollateral < depositTarget) {
    const depositTx = await vault.deposit(depositTarget - beforeCollateral);
    await depositTx.wait();
    txs.deposit = depositTx.hash;
  }

  const storkKey = process.env.STORK_API_KEY;
  async function updateOracle(moveBps = 0) {
    let updates: any[];
    if (oracleMode === "stork") {
      if (!storkKey) throw new Error("STORK_API_KEY is required when oracleMode=stork");
      updates = await fetchStorkUpdate(storkKey);
    } else {
      const [currentPrice] = await oracle.latestPrice(market.feedId);
      const nextPrice = moveBps === 0 ? currentPrice : (currentPrice * BigInt(10_000 + moveBps)) / 10_000n;
      const latestBlock = await ethers.provider.getBlock("latest");
      if (!latestBlock) throw new Error("Could not read latest Horizen block");
      updates = [{
        temporalNumericValue: {
          timestampNs: BigInt(latestBlock.timestamp) * 1_000_000_000n,
          quantizedValue: nextPrice
        },
        id: market.feedId,
        publisherMerkleRoot: ZERO32,
        valueComputeAlgHash: ZERO32,
        r: ZERO32,
        s: ZERO32,
        v: 27
      }];
    }
    const fee = await oracle.getUpdateFee(updates);
    const updateTx = await oracle.updatePrices(updates, { value: fee });
    await updateTx.wait();
    return updateTx.hash as string;
  }

  txs.oracleOpen = await updateOracle(0);
  const [openPrice] = await oracle.latestPrice(market.feedId);
  const longLimit = (openPrice * 10_050n) / 10_000n;

  const openTx = await engine.openPosition(marketId, true, margin, 20_000, longLimit);
  await openTx.wait();
  txs.open = openTx.hash;
  const opened = await engine.positions(trader.address, marketId);
  if (opened.sizeUsd === 0n || opened.margin !== margin) throw new Error("Position did not open correctly");

  txs.oracleClose = await updateOracle(oracleMode === "demo" ? 50 : 0);
  const [closePrice] = await oracle.latestPrice(market.feedId);
  const closeLimit = (closePrice * 9_950n) / 10_000n;
  const pnlBeforeClose = await engine.getUnrealizedPnl(trader.address, marketId);
  if (oracleMode === "demo" && pnlBeforeClose <= 0n) throw new Error("Demo price move did not produce positive long PnL");

  const closeTx = await engine.closePosition(marketId, 10_000, closeLimit);
  await closeTx.wait();
  txs.close = closeTx.hash;
  const closed = await engine.positions(trader.address, marketId);
  if (closed.sizeUsd !== 0n) throw new Error("Position did not close fully");
  if ((await vault.reservedMargin(trader.address)) !== 0n) throw new Error("Reserved margin was not released");

  const strategy = "Symbasis smoke: max 2x leverage, ETH-PERP only, deterministic test mandate";
  const commitment = ethers.keccak256(ethers.toUtf8Bytes(strategy));
  const intentTx = await intents.submitIntent(commitment);
  await intentTx.wait();
  txs.intent = intentTx.hash;

  const free = await vault.availableCollateral(trader.address);
  if (free > 0n) {
    const withdrawTx = await vault.withdraw(free);
    await withdrawTx.wait();
    txs.withdraw = withdrawTx.hash;
  }

  const smoke = {
    status: "PASS",
    chainId: Number(network.chainId),
    oracleMode,
    trader: trader.address,
    market: "ETH-PERP",
    openingPrice: openPrice.toString(),
    closingPrice: closePrice.toString(),
    pnlBeforeClose: pnlBeforeClose.toString(),
    finalReservedMargin: (await vault.reservedMargin(trader.address)).toString(),
    commitment,
    transactions: txs,
    completedAt: new Date().toISOString()
  };

  const output = path.join(process.cwd(), "deployments", "horizen-testnet-smoke.json");
  fs.writeFileSync(output, JSON.stringify(smoke, null, 2) + "\n");
  console.log("Symbasis real Horizen testnet trading smoke test: PASS");
  console.log(JSON.stringify(smoke, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});