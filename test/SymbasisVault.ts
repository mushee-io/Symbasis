import { expect } from "chai";
import { ethers } from "hardhat";

describe("SymbasisVault", function () {
  async function fixture() {
    const [owner, trader, engine] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockUSDC");
    const token = await Token.deploy();
    await token.waitForDeployment();

    const Vault = await ethers.getContractFactory("SymbasisVault");
    const vault = await Vault.deploy(await token.getAddress());
    await vault.waitForDeployment();
    await vault.setEngine(engine.address);

    await token.mint(trader.address, ethers.parseUnits("10000", 6));
    await token.connect(trader).approve(await vault.getAddress(), ethers.MaxUint256);
    return { owner, trader, engine, token, vault };
  }

  it("deposits and withdraws 6-decimal collateral", async function () {
    const { trader, vault } = await fixture();
    const amount = ethers.parseUnits("1000", 6);

    await expect(vault.connect(trader).deposit(amount))
      .to.emit(vault, "CollateralDeposited")
      .withArgs(trader.address, amount);

    await vault.connect(trader).withdraw(ethers.parseUnits("250", 6));
    expect(await vault.collateral(trader.address)).to.equal(ethers.parseUnits("750", 6));
  });

  it("prevents withdrawing reserved margin", async function () {
    const { trader, engine, vault } = await fixture();
    await vault.connect(trader).deposit(ethers.parseUnits("1000", 6));
    await vault.connect(engine).reserveMargin(trader.address, ethers.parseUnits("700", 6));

    expect(await vault.availableCollateral(trader.address)).to.equal(ethers.parseUnits("300", 6));
    await expect(
      vault.connect(trader).withdraw(ethers.parseUnits("301", 6))
    ).to.be.revertedWith("MARGIN_LOCKED");
  });

  it("only allows the configured engine to reserve and settle", async function () {
    const { trader, vault } = await fixture();
    await expect(vault.reserveMargin(trader.address, 1)).to.be.revertedWith("NOT_ENGINE");
    await expect(vault.settlePnl(trader.address, 1)).to.be.revertedWith("NOT_ENGINE");
  });
});
