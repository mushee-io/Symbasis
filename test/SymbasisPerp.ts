import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Symbasis perpetual engine", function () {
  async function fixture() {
    const [owner, trader, liquidator] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockUSDC");
    const token = await Token.deploy();
    await token.waitForDeployment();

    const Vault = await ethers.getContractFactory("SymbasisVault");
    const vault = await Vault.deploy(await token.getAddress());
    await vault.waitForDeployment();

    const Registry = await ethers.getContractFactory("MarketRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();

    const Oracle = await ethers.getContractFactory("MockPriceOracle");
    const oracle = await Oracle.deploy();
    await oracle.waitForDeployment();

    const Engine = await ethers.getContractFactory("PerpEngine");
    const engine = await Engine.deploy(
      await vault.getAddress(),
      await registry.getAddress(),
      await oracle.getAddress()
    );
    await engine.waitForDeployment();
    await vault.setEngine(await engine.getAddress());

    const marketId = ethers.id("ETH-PERP");
    const feedId = ethers.id("ETHUSD-MOCK");
    await registry.addMarket(
      marketId,
      "ETH-PERP",
      feedId,
      100_000,
      500,
      ethers.parseUnits("100000", 6),
      ethers.parseUnits("1000000", 6)
    );

    await token.mint(owner.address, ethers.parseUnits("500000", 6));
    await token.approve(await vault.getAddress(), ethers.MaxUint256);
    await vault.seedLiquidity(ethers.parseUnits("400000", 6));

    await token.mint(trader.address, ethers.parseUnits("10000", 6));
    await token.connect(trader).approve(await vault.getAddress(), ethers.MaxUint256);
    await vault.connect(trader).deposit(ethers.parseUnits("5000", 6));
    await oracle.setPrice(feedId, ethers.parseUnits("3000", 18));

    return { owner, trader, liquidator, token, vault, registry, oracle, engine, marketId, feedId };
  }

  it("opens a leveraged long, realizes profit, and releases margin", async function () {
    const { trader, vault, oracle, engine, marketId, feedId } = await fixture();

    await engine.connect(trader).openPosition(
      marketId,
      true,
      ethers.parseUnits("1000", 6),
      30_000,
      ethers.parseUnits("3030", 18)
    );

    expect(await vault.reservedMargin(trader.address)).to.equal(ethers.parseUnits("1000", 6));

    await oracle.setPrice(feedId, ethers.parseUnits("3300", 18));
    expect(await engine.getUnrealizedPnl(trader.address, marketId)).to.equal(ethers.parseUnits("300", 6));

    await engine.connect(trader).closePosition(marketId, 10_000, ethers.parseUnits("3267", 18));

    expect(await vault.reservedMargin(trader.address)).to.equal(0);
    expect(await vault.collateral(trader.address)).to.equal(ethers.parseUnits("5300", 6));
  });

  it("supports partial reduce-only closes", async function () {
    const { trader, vault, oracle, engine, marketId, feedId } = await fixture();
    await engine.connect(trader).openPosition(
      marketId,
      true,
      ethers.parseUnits("1000", 6),
      20_000,
      ethers.parseUnits("3030", 18)
    );

    await oracle.setPrice(feedId, ethers.parseUnits("3150", 18));
    await engine.connect(trader).closePosition(marketId, 5_000, ethers.parseUnits("3100", 18));

    const position = await engine.positions(trader.address, marketId);
    expect(position.sizeUsd).to.equal(ethers.parseUnits("1000", 6));
    expect(position.margin).to.equal(ethers.parseUnits("500", 6));
    expect(await vault.reservedMargin(trader.address)).to.equal(ethers.parseUnits("500", 6));
  });

  it("charges positive funding to longs", async function () {
    const { trader, vault, engine, marketId } = await fixture();
    await engine.setFundingRate(marketId, 100); // 1% per day
    await engine.connect(trader).openPosition(
      marketId,
      true,
      ethers.parseUnits("1000", 6),
      30_000,
      ethers.parseUnits("3030", 18)
    );

    await time.increase(24 * 60 * 60);
    const pnl = await engine.getUnrealizedPnl(trader.address, marketId);
    expect(pnl).to.equal(-ethers.parseUnits("30", 6));

    await engine.connect(trader).closePosition(marketId, 10_000, ethers.parseUnits("2990", 18));
    expect(await vault.collateral(trader.address)).to.equal(ethers.parseUnits("4970", 6));
  });

  it("allows permissionless liquidation below maintenance margin", async function () {
    const { trader, liquidator, vault, oracle, engine, marketId, feedId } = await fixture();
    await engine.connect(trader).openPosition(
      marketId,
      true,
      ethers.parseUnits("1000", 6),
      50_000,
      ethers.parseUnits("3030", 18)
    );

    await oracle.setPrice(feedId, ethers.parseUnits("2500", 18));
    expect(await engine.isLiquidatable(trader.address, marketId)).to.equal(true);

    await expect(engine.connect(liquidator).liquidate(trader.address, marketId))
      .to.emit(engine, "PositionLiquidated");

    expect(await vault.reservedMargin(trader.address)).to.equal(0);
    const position = await engine.positions(trader.address, marketId);
    expect(position.sizeUsd).to.equal(0);
  });

  it("handles short PnL correctly", async function () {
    const { trader, vault, oracle, engine, marketId, feedId } = await fixture();
    await engine.connect(trader).openPosition(
      marketId,
      false,
      ethers.parseUnits("1000", 6),
      20_000,
      ethers.parseUnits("2970", 18)
    );
    await oracle.setPrice(feedId, ethers.parseUnits("2700", 18));
    expect(await engine.getUnrealizedPnl(trader.address, marketId)).to.equal(ethers.parseUnits("200", 6));
    await engine.connect(trader).closePosition(marketId, 10_000, ethers.parseUnits("2730", 18));
    expect(await vault.collateral(trader.address)).to.equal(ethers.parseUnits("5200", 6));
  });
});
