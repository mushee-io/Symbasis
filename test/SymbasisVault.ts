import { expect } from "chai";
import { ethers } from "hardhat";

describe("SymbasisVault", function () {
  it("tracks deposits and allows withdrawals", async function () {
    const [trader] = await ethers.getSigners();
    const Vault = await ethers.getContractFactory("SymbasisVault");
    const vault = await Vault.deploy();
    await vault.waitForDeployment();

    const depositAmount = ethers.parseEther("1");
    await expect(vault.deposit({ value: depositAmount }))
      .to.emit(vault, "CollateralDeposited")
      .withArgs(trader.address, depositAmount);

    expect(await vault.collateral(trader.address)).to.equal(depositAmount);

    const withdrawal = ethers.parseEther("0.4");
    await expect(vault.withdraw(withdrawal))
      .to.emit(vault, "CollateralWithdrawn")
      .withArgs(trader.address, withdrawal);

    expect(await vault.collateral(trader.address)).to.equal(ethers.parseEther("0.6"));
  });

  it("rejects zero deposits and over-withdrawals", async function () {
    const Vault = await ethers.getContractFactory("SymbasisVault");
    const vault = await Vault.deploy();
    await vault.waitForDeployment();

    await expect(vault.deposit({ value: 0 })).to.be.revertedWith("ZERO_DEPOSIT");
    await expect(vault.withdraw(1)).to.be.revertedWith("INSUFFICIENT_COLLATERAL");
  });
});
