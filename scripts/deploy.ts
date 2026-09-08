import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  if (network.chainId !== 2651420n) {
    throw new Error(`Refusing deployment: expected Horizen testnet 2651420, got ${network.chainId}`);
  }

  console.log(`Deploying SymbasisVault from ${deployer.address}`);
  const Vault = await ethers.getContractFactory("SymbasisVault");
  const vault = await Vault.deploy();
  await vault.waitForDeployment();

  console.log(`SymbasisVault deployed: ${await vault.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
