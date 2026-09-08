import { ethers } from "hardhat";
import fs from "node:fs";
import path from "node:path";

const EXPECTED_CHAIN_ID = 2651420n;
const EXPECTED_STORK = "0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62";

async function requireCode(address: string, label: string) {
  const code = await ethers.provider.getCode(address);
  if (code === "0x") throw new Error(`${label} has no bytecode at ${address}`);
}

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Wrong chain: expected ${EXPECTED_CHAIN_ID}, got ${network.chainId}`);
  }

  const deploymentPath = path.join(process.cwd(), "deployments", "horizen-testnet.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error("deployments/horizen-testnet.json not found. Deploy the stack first.");
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  if (BigInt(deployment.chainId) !== EXPECTED_CHAIN_ID) throw new Error("Deployment artifact chain ID mismatch");

  const c = deployment.contracts;
  for (const [label, address] of Object.entries(c as Record<string, string>)) {
    await requireCode(address, label);
  }
  await requireCode(EXPECTED_STORK, "Stork oracle");

  const vault = await ethers.getContractAt("SymbasisVault", c.vault);
  const registry = await ethers.getContractAt("MarketRegistry", c.marketRegistry);
  const oracle = await ethers.getContractAt("StorkOracleAdapter", c.storkOracleAdapter);
  const engine = await ethers.getContractAt("PerpEngine", c.perpEngine);
  const intents = await ethers.getContractAt("ConfidentialIntentRegistry", c.confidentialIntentRegistry);

  if ((await vault.engine()).toLowerCase() !== String(c.perpEngine).toLowerCase()) throw new Error("Vault engine mismatch");
  if (!(await vault.engineLocked())) throw new Error("Vault engine is not permanently locked");
  if ((await vault.liquidityBalance()) <= 0n) throw new Error("Protocol test liquidity is empty");
  if ((await oracle.stork()).toLowerCase() !== EXPECTED_STORK.toLowerCase()) throw new Error("Oracle Stork address mismatch");

  if ((await engine.vault()).toLowerCase() !== String(c.vault).toLowerCase()) throw new Error("Engine vault mismatch");
  if ((await engine.markets()).toLowerCase() !== String(c.marketRegistry).toLowerCase()) throw new Error("Engine market registry mismatch");
  if ((await engine.oracle()).toLowerCase() !== String(c.storkOracleAdapter).toLowerCase()) throw new Error("Engine oracle mismatch");

  const ethId = ethers.id("ETH-PERP");
  const btcId = ethers.id("BTC-PERP");
  const eth = await registry.getMarket(ethId);
  const btc = await registry.getMarket(btcId);
  if (!eth.active || !btc.active) throw new Error("One or more markets are inactive");

  for (const [label, contract] of [
    ["vault", vault],
    ["registry", registry],
    ["oracle", oracle],
    ["engine", engine],
    ["intents", intents]
  ] as const) {
    const owner = await contract.owner();
    if (owner === ethers.ZeroAddress) throw new Error(`${label} has zero owner`);
  }

  const latestBlock = await ethers.provider.getBlockNumber();
  console.log("Symbasis Horizen testnet deployment verification: PASS");
  console.log(`chainId=${network.chainId}`);
  console.log(`latestBlock=${latestBlock}`);
  console.log(`protocolLiquidity=${ethers.formatUnits(await vault.liquidityBalance(), 6)} sUSDC`);
  console.log(`ETH-PERP=${eth.symbol} active=${eth.active}`);
  console.log(`BTC-PERP=${btc.symbol} active=${btc.active}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});