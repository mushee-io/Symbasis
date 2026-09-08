import { ethers } from "hardhat";
import fs from "node:fs";
import path from "node:path";

const HORIZEN_TESTNET_CHAIN_ID = 2651420n;
const STORK_ADDRESS = "0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62";
const ETH_USD_FEED = "0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160";
const BTC_USD_FEED = "0x7404e3d104ea7841c3d9e6fd20adfe99b4ad586bc08d8f3bd3afef894cf184de";
const ORACLE_MODE = (process.env.ORACLE_MODE ?? "demo").toLowerCase();

async function requireCode(address: string, label: string) {
  const code = await ethers.provider.getCode(address);
  if (code === "0x") throw new Error(`${label} has no bytecode at ${address}`);
}

async function main() {
  if (ORACLE_MODE !== "demo" && ORACLE_MODE !== "stork") {
    throw new Error(`Unsupported ORACLE_MODE=${ORACLE_MODE}. Use demo or stork.`);
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployer signer configured. Set PRIVATE_KEY locally or HORIZEN_DEPLOYER_PRIVATE_KEY in CI.");

  const network = await ethers.provider.getNetwork();
  if (network.chainId !== HORIZEN_TESTNET_CHAIN_ID) {
    throw new Error(`Refusing deployment: expected Horizen testnet ${HORIZEN_TESTNET_CHAIN_ID}, got ${network.chainId}`);
  }

  if (ORACLE_MODE === "stork") await requireCode(STORK_ADDRESS, "Stork oracle");

  const balance = await ethers.provider.getBalance(deployer.address);
  if (balance === 0n) {
    throw new Error(`Deployer ${deployer.address} has no Horizen testnet ETH. Fund it from https://hub-testnet.horizen.io/`);
  }

  const deploymentBlockStart = await ethers.provider.getBlockNumber();
  console.log(`Deploying Symbasis from ${deployer.address}`);
  console.log(`Oracle mode: ${ORACLE_MODE}`);
  console.log(`Deployer ETH: ${ethers.formatEther(balance)}`);

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const Vault = await ethers.getContractFactory("SymbasisVault");
  const vault = await Vault.deploy(await usdc.getAddress());
  await vault.waitForDeployment();

  const Registry = await ethers.getContractFactory("MarketRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  let oracle: any;
  const oracleTransactions: Record<string, string | null> = {};
  if (ORACLE_MODE === "stork") {
    const Oracle = await ethers.getContractFactory("StorkOracleAdapter");
    oracle = await Oracle.deploy(STORK_ADDRESS);
    await oracle.waitForDeployment();
    oracleTransactions.deployOracle = oracle.deploymentTransaction()?.hash ?? null;
  } else {
    const Oracle = await ethers.getContractFactory("DemoPriceOracle");
    oracle = await Oracle.deploy();
    await oracle.waitForDeployment();
    oracleTransactions.deployOracle = oracle.deploymentTransaction()?.hash ?? null;

    const configureEth = await oracle.configureFeed(ETH_USD_FEED, ethers.parseUnits("3500", 18));
    await configureEth.wait();
    const configureBtc = await oracle.configureFeed(BTC_USD_FEED, ethers.parseUnits("110000", 18));
    await configureBtc.wait();
    oracleTransactions.configureDemoEth = configureEth.hash;
    oracleTransactions.configureDemoBtc = configureBtc.hash;
  }

  const Engine = await ethers.getContractFactory("PerpEngine");
  const engine = await Engine.deploy(
    await vault.getAddress(),
    await registry.getAddress(),
    await oracle.getAddress()
  );
  await engine.waitForDeployment();

  const Intents = await ethers.getContractFactory("ConfidentialIntentRegistry");
  const intents = await Intents.deploy();
  await intents.waitForDeployment();

  const oracleAddress = await oracle.getAddress();
  const addresses = {
    mockUSDC: await usdc.getAddress(),
    vault: await vault.getAddress(),
    marketRegistry: await registry.getAddress(),
    oracle: oracleAddress,
    storkOracleAdapter: oracleAddress,
    perpEngine: await engine.getAddress(),
    confidentialIntentRegistry: await intents.getAddress()
  };

  for (const [label, address] of Object.entries(addresses)) await requireCode(address, label);

  const configureEngineTx = await vault.setEngine(addresses.perpEngine);
  await configureEngineTx.wait();

  const ethMarketId = ethers.id("ETH-PERP");
  const btcMarketId = ethers.id("BTC-PERP");
  const maxLeverageBps = 100_000;
  const maintenanceMarginBps = 500;
  const maxPositionSize = ethers.parseUnits("100000", 6);
  const maxOpenInterest = ethers.parseUnits("1000000", 6);

  const addEthTx = await registry.addMarket(
    ethMarketId, "ETH-PERP", ETH_USD_FEED, maxLeverageBps, maintenanceMarginBps, maxPositionSize, maxOpenInterest
  );
  await addEthTx.wait();
  const addBtcTx = await registry.addMarket(
    btcMarketId, "BTC-PERP", BTC_USD_FEED, maxLeverageBps, maintenanceMarginBps, maxPositionSize, maxOpenInterest
  );
  await addBtcTx.wait();

  const seedMint = ethers.parseUnits("1000000", 6);
  const seedLiquidity = ethers.parseUnits("500000", 6);
  const mintTx = await usdc.mint(deployer.address, seedMint);
  await mintTx.wait();
  const approveTx = await usdc.approve(addresses.vault, seedLiquidity);
  await approveTx.wait();
  const seedTx = await vault.seedLiquidity(seedLiquidity);
  await seedTx.wait();

  const lockEngineTx = await vault.lockEngine();
  await lockEngineTx.wait();

  if ((await vault.engine()).toLowerCase() !== addresses.perpEngine.toLowerCase()) throw new Error("Vault engine wiring mismatch");
  if (!(await vault.engineLocked())) throw new Error("Vault engine was not locked");
  if ((await vault.liquidityBalance()) !== seedLiquidity) throw new Error("Seed liquidity mismatch");
  if ((await engine.oracle()).toLowerCase() !== oracleAddress.toLowerCase()) throw new Error("Engine oracle wiring mismatch");

  if (ORACLE_MODE === "stork") {
    if ((await oracle.stork()).toLowerCase() !== STORK_ADDRESS.toLowerCase()) throw new Error("Stork adapter wiring mismatch");
  } else {
    const [ethSeed] = await oracle.latestPrice(ETH_USD_FEED);
    const [btcSeed] = await oracle.latestPrice(BTC_USD_FEED);
    if (ethSeed !== ethers.parseUnits("3500", 18) || btcSeed !== ethers.parseUnits("110000", 18)) {
      throw new Error("Demo oracle seed prices mismatch");
    }
  }

  const ethMarket = await registry.getMarket(ethMarketId);
  const btcMarket = await registry.getMarket(btcMarketId);
  if (!ethMarket.active || ethMarket.feedId.toLowerCase() !== ETH_USD_FEED.toLowerCase()) throw new Error("ETH-PERP market wiring mismatch");
  if (!btcMarket.active || btcMarket.feedId.toLowerCase() !== BTC_USD_FEED.toLowerCase()) throw new Error("BTC-PERP market wiring mismatch");

  const deploymentBlockEnd = await ethers.provider.getBlockNumber();
  const deployment = {
    chainId: Number(network.chainId),
    network: "horizen-testnet",
    oracleMode: ORACLE_MODE,
    testnetOnly: true,
    deployer: deployer.address,
    deploymentBlockStart,
    deploymentBlockEnd,
    stork: ORACLE_MODE === "stork" ? STORK_ADDRESS : null,
    feeds: { ETHUSD: ETH_USD_FEED, BTCUSD: BTC_USD_FEED },
    markets: { ETH_PERP: ethMarketId, BTC_PERP: btcMarketId },
    contracts: addresses,
    transactions: {
      deployMockUSDC: usdc.deploymentTransaction()?.hash ?? null,
      deployVault: vault.deploymentTransaction()?.hash ?? null,
      deployMarketRegistry: registry.deploymentTransaction()?.hash ?? null,
      ...oracleTransactions,
      deployPerpEngine: engine.deploymentTransaction()?.hash ?? null,
      deployConfidentialIntentRegistry: intents.deploymentTransaction()?.hash ?? null,
      configureEngine: configureEngineTx.hash,
      addEthMarket: addEthTx.hash,
      addBtcMarket: addBtcTx.hash,
      mintSeedCollateral: mintTx.hash,
      approveSeedLiquidity: approveTx.hash,
      seedLiquidity: seedTx.hash,
      lockEngine: lockEngineTx.hash
    }
  };

  const outDir = path.join(process.cwd(), "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "horizen-testnet.json");
  fs.writeFileSync(jsonPath, JSON.stringify(deployment, null, 2) + "\n");

  const envPath = path.join(outDir, "horizen-testnet.web.env");
  fs.writeFileSync(envPath, [
    `NEXT_PUBLIC_ORACLE_MODE=${ORACLE_MODE}`,
    `NEXT_PUBLIC_MOCK_USDC_ADDRESS=${addresses.mockUSDC}`,
    `NEXT_PUBLIC_VAULT_ADDRESS=${addresses.vault}`,
    `NEXT_PUBLIC_MARKET_REGISTRY_ADDRESS=${addresses.marketRegistry}`,
    `NEXT_PUBLIC_ORACLE_ADDRESS=${addresses.oracle}`,
    `NEXT_PUBLIC_STORK_ADAPTER_ADDRESS=${addresses.storkOracleAdapter}`,
    `NEXT_PUBLIC_PERP_ENGINE_ADDRESS=${addresses.perpEngine}`,
    `NEXT_PUBLIC_CONFIDENTIAL_INTENT_REGISTRY_ADDRESS=${addresses.confidentialIntentRegistry}`,
    ""
  ].join("\n"));

  console.log("Symbasis deployment verified and finalized.");
  console.log(JSON.stringify(deployment, null, 2));
  console.log(`Web env written to ${envPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});