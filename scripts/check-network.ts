import { ethers } from "hardhat";

const HORIZEN_TESTNET_CHAIN_ID = 2651420n;
const STORK_ADDRESS = "0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62";

async function main() {
  const network = await ethers.provider.getNetwork();
  const block = await ethers.provider.getBlock("latest");

  if (network.chainId !== HORIZEN_TESTNET_CHAIN_ID) {
    throw new Error(`Wrong network: expected ${HORIZEN_TESTNET_CHAIN_ID}, got ${network.chainId}`);
  }
  if (!block) {
    throw new Error("Horizen testnet RPC returned no latest block");
  }

  const storkCode = await ethers.provider.getCode(STORK_ADDRESS);
  if (storkCode === "0x") {
    throw new Error(`No Stork bytecode found at ${STORK_ADDRESS}`);
  }

  console.log(
    `Horizen testnet OK | chainId=${network.chainId} | block=${block.number} | timestamp=${block.timestamp} | Stork=${STORK_ADDRESS}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
