import { ethers } from "hardhat";
import fs from "node:fs";
import path from "node:path";

const HORIZEN_TESTNET_CHAIN_ID = 2651420n;
const STORK_ADDRESS = "0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62";
const ETH_USD_FEED = "0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160";
const BTC_USD_FEED = "0x7404e3d104ea7841c3d9e6fd20adfe99b4ad586bc08d8f3bd3afef894cf184de";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  if (network.chainId !== HORIZEN_TESTNET_CHAIN_ID) {
    throw new Error(`Refusing deployment: expected Horizen testnet ${HORIZEN_TESTNET_CHAIN_ID}, got ${network.chainId}`);
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  if (balance === 0n) {
    throw new Error(`Deployer ${deployer.address} has no Horizen testnet ETH. Fund it from https://hub-testnet.horizen.io/`);
  }

  console.log(`Deploying Symbasis from ${deployer.address}`);
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

  const Oracle = await ethers.getContractFactory("StorkOracleAdapter");
  const oracle = await Oracle.deploy(STORK_ADDRESS);
  await oracle.waitForDeployment();

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

  await (await vault.setEngine(await engine.getAddress())).wait();

  const ethMarketId = ethers.id("ETH-PERP");
  const btcMarketId = ethers.id("BTC-PERP");
  const maxLeverageBps = 100_000; // 10x
  const maintenanceMarginBps = 500; // 5%
  const maxPositionSize = ethers.parseUnits("100000", 6);
  const maxOpenInterest = ethers.parseUnits("1000000", 6);

  await (
    await registry.addMarket(
      ethMarketId,
      "ETH-PERP",
      ETH_USD_FEED,
      maxLeverageBps,
      maintenanceMarginBps,
      maxPositionSize,
      maxOpenInterest
    )
  ).wait();

  await (
    await registry.addMarket(
      btcMarketId,
      "BTC-PERP",
      BTC_USD_FEED,
      maxLeverageBps,
      maintenanceMarginBps,
      maxPositionSize,
      maxOpenInterest
    )
  ).wait();

  const seedMint = ethers.parseUnits("1000000", 6);
  const seedLiquidity = ethers.parseUnits("500000", 6);
  await (await usdc.mint(deployer.address, seedMint)).wait();
  await (await usdc.approve(await vault.getAddress(), seedLiquidity)).wait();
  await (await vault.seedLiquidity(seedLiquidity)).wait();

  const deployment = {
    chainId: Number(network.chainId),
    network: "horizen-testnet",
    deployer: deployer.address,
    stork: STORK_ADDRESS,
    feeds: {
      ETHUSD: ETH_USD_FEED,
      BTCUSD: BTC_USD_FEED
    },
    markets: {
      ETH_PERP: ethMarketId,
      BTC_PERP: btcMarketId
    },
    contracts: {
      mockUSDC: await usdc.getAddress(),
      vault: await vault.getAddress(),
      marketRegistry: await registry.getAddress(),
      storkOracleAdapter: await oracle.getAddress(),
      perpEngine: await engine.getAddress(),
      confidentialIntentRegistry: await intents.getAddress()
    }
  };

  const outDir = path.join(process.cwd(), "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "horizen-testnet.json"),
    JSON.stringify(deployment, null, 2) + "\n"
  );

  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
