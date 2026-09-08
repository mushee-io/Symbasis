import { ethers } from "hardhat";

const EXPECTED_CHAIN_ID = 2651420n;

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Wrong network: expected Horizen testnet ${EXPECTED_CHAIN_ID}, got ${network.chainId}`);
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer signer is available. Add a GitHub Actions SECRET named HORIZEN_DEPLOYER_PRIVATE_KEY (preferred) or PRIVATE_KEY."
    );
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Preflight deployer: ${deployer.address}`);
  console.log(`Horizen testnet ETH balance: ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error(
      `Deployer ${deployer.address} has zero Horizen testnet ETH. Fund this exact address before deployment.`
    );
  }

  console.log("Deployment preflight PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
