import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Symbasis security invariants", function () {
  async function fixture() {
    const [owner, trader, other] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockUSDC");
    const token = await Token.deploy();
    const Vault = await ethers.getContractFactory("SymbasisVault");
    const vault = await Vault.deploy(await token.getAddress());
    const Registry = await ethers.getContractFactory("MarketRegistry");
    const registry = await Registry.deploy();
    const Oracle = await ethers.getContractFactory("MockPriceOracle");
    const oracle = await Oracle.deploy();
    const Engine = await ethers.getContractFactory("PerpEngine");
    const engine = await Engine.deploy(
      await vault.getAddress(),
      await registry.getAddress(),
      await oracle.getAddress()
    );

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
    await oracle.setPrice(feedId, ethers.parseUnits("3000", 18));

    await token.mint(owner.address, ethers.parseUnits("200000", 6));
    await token.approve(await vault.getAddress(), ethers.MaxUint256);
    await vault.seedLiquidity(ethers.parseUnits("150000", 6));

    for (const account of [trader, other]) {
      await token.mint(account.address, ethers.parseUnits("10000", 6));
      await token.connect(account).approve(await vault.getAddress(), ethers.MaxUint256);
      await vault.connect(account).deposit(ethers.parseUnits("5000", 6));
    }

    return { owner, trader, other, token, vault, registry, oracle, engine, marketId, feedId };
  }

  it("enforces slippage limits on entry", async function () {
    const { trader, engine, marketId } = await fixture();
    await expect(
      engine.connect(trader).openPosition(
        marketId,
        true,
        ethers.parseUnits("1000", 6),
        20_000,
        ethers.parseUnits("2999", 18)
      )
    ).to.be.revertedWith("LONG_SLIPPAGE");
  });

  it("emergency pause blocks new risk but keeps exits and free withdrawals live", async function () {
    const { trader, vault, engine, marketId } = await fixture();

    await engine.connect(trader).openPosition(
      marketId,
      true,
      ethers.parseUnits("1000", 6),
      20_000,
      ethers.parseUnits("3030", 18)
    );

    await engine.setPaused(true);
    await vault.setPaused(true);

    await expect(
      engine.connect(trader).openPosition(
        marketId,
        true,
        ethers.parseUnits("100", 6),
        10_000,
        ethers.parseUnits("3030", 18)
      )
    ).to.be.revertedWith("PAUSED");
    await expect(vault.connect(trader).deposit(1)).to.be.revertedWith("PAUSED");

    await expect(
      engine.connect(trader).closePosition(marketId, 10_000, ethers.parseUnits("2900", 18))
    ).to.emit(engine, "PositionReduced");

    await expect(vault.connect(trader).withdraw(ethers.parseUnits("100", 6)))
      .to.emit(vault, "CollateralWithdrawn");
  });

  it("locks the engine and protocol liquidity after deployment finalization", async function () {
    const { other, vault } = await fixture();
    await vault.lockEngine();

    await expect(vault.setEngine(other.address)).to.be.revertedWith("ENGINE_LOCKED");
    await expect(vault.withdrawLiquidity(other.address, 1)).to.be.revertedWith("LIQUIDITY_WITHDRAWALS_LOCKED");
  });

  it("uses two-step ownership so a bad transfer cannot instantly seize admin", async function () {
    const { owner, other, vault } = await fixture();
    await vault.transferOwnership(other.address);

    expect(await vault.owner()).to.equal(owner.address);
    expect(await vault.pendingOwner()).to.equal(other.address);
    await expect(vault.connect(other).setPaused(true)).to.be.revertedWith("NOT_OWNER");

    await vault.connect(other).acceptOwnership();
    expect(await vault.owner()).to.equal(other.address);
    await vault.connect(other).setPaused(true);
    expect(await vault.paused()).to.equal(true);
  });

  it("caps isolated-position loss at posted margin across randomized prices", async function () {
    const { trader, oracle, engine, marketId, feedId } = await fixture();
    const margin = ethers.parseUnits("1000", 6);
    await engine.connect(trader).openPosition(
      marketId,
      true,
      margin,
      100_000,
      ethers.parseUnits("3030", 18)
    );

    let seed = 0x12345678;
    for (let i = 0; i < 40; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const price = 100 + (seed % 5901);
      await oracle.setPrice(feedId, ethers.parseUnits(price.toString(), 18));
      const pnl = await engine.getUnrealizedPnl(trader.address, marketId);
      expect(pnl).to.be.gte(-margin);
    }
  });

  it("rejects unauthorized configuration changes", async function () {
    const { other, vault, registry, engine, marketId } = await fixture();
    await expect(vault.connect(other).setPaused(true)).to.be.revertedWith("NOT_OWNER");
    await expect(registry.connect(other).setActive(marketId, false)).to.be.revertedWith("NOT_OWNER");
    await expect(engine.connect(other).setFundingRate(marketId, 1)).to.be.revertedWith("NOT_OWNER");
  });

  it("rejects stale Stork prices and accepts fresh ones", async function () {
    const MockStork = await ethers.getContractFactory("MockStork");
    const stork = await MockStork.deploy();
    const Adapter = await ethers.getContractFactory("StorkOracleAdapter");
    const adapter = await Adapter.deploy(await stork.getAddress());
    const feedId = ethers.id("ETHUSD-STORK-MOCK");

    const now = await time.latest();
    await stork.setValue(feedId, ethers.parseUnits("3000", 18), BigInt(now - 121) * 1_000_000_000n);
    await expect(adapter.latestPrice(feedId)).to.be.revertedWith("STALE_PRICE");

    await stork.setValue(feedId, ethers.parseUnits("3000", 18), BigInt(await time.latest()) * 1_000_000_000n);
    const [price] = await adapter.latestPrice(feedId);
    expect(price).to.equal(ethers.parseUnits("3000", 18));
  });

  it("stores only a commitment and protects attestor rotation with two steps", async function () {
    const { trader, other } = await fixture();
    const Registry = await ethers.getContractFactory("ConfidentialIntentRegistry");
    const intents = await Registry.deploy();
    const commitment = ethers.keccak256(ethers.toUtf8Bytes("private strategy payload"));

    const tx = await intents.connect(trader).submitIntent(commitment);
    const receipt = await tx.wait();
    const log = receipt!.logs
      .map((entry) => {
        try { return intents.interface.parseLog(entry); } catch { return null; }
      })
      .find((entry) => entry?.name === "IntentSubmitted");

    const intentId = log!.args.intentId;
    const intent = await intents.intents(intentId);
    expect(intent.trader).to.equal(trader.address);
    expect(intent.commitment).to.equal(commitment);

    await expect(
      intents.connect(other).recordAttestation(intentId, ethers.id("result"), ethers.id("attestation"))
    ).to.be.revertedWith("NOT_ATTESTOR");

    await intents.setAttestor(other.address);
    expect(await intents.attestor()).to.not.equal(other.address);
    await intents.connect(other).acceptAttestor();
    await intents.connect(other).recordAttestation(intentId, ethers.id("result"), ethers.id("attestation"));
    expect((await intents.intents(intentId)).executed).to.equal(true);
  });
});
