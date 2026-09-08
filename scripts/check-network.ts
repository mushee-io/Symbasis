import { ethers } from "hardhat";

async function main() {
  const network = await ethers.provider.getNetwork();
  const block = await ethers.provider.getBlockNumber();

  if (network.chainId !== 2651420n) {
    throw new Error(`Wrong network: expected 2651420, got ${network.chainId}`);
  }

  console.log(`Horizen testnet OK | chainId=${network.chainId} | block=${block}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
