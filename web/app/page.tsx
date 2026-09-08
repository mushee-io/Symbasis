"use client";

import {
  BrowserProvider,
  Contract,
  MaxUint256,
  formatEther,
  formatUnits,
  id,
  keccak256,
  parseUnits,
  toUtf8Bytes
} from "ethers";
import { useMemo, useState } from "react";
import { CONTRACTS, HORIZEN_TESTNET, MARKETS, MarketKey, contractsConfigured } from "@/lib/config";
import { ENGINE_ABI, ERC20_ABI, INTENT_ABI, ORACLE_ABI, VAULT_ABI } from "@/lib/abis";

type PositionView = {
  size: string;
  margin: string;
  entry: string;
  leverage: string;
  side: "LONG" | "SHORT";
  pnl: string;
  liquidation: string;
};

type RiskView = {
  score: number;
  level: string;
  recommendedLeverage: number;
  suggestedMargin: number;
  suggestedPosition: number;
  liquidationDistance: string;
  warnings: string[];
};

type HistoryItem = {
  time: string;
  action: string;
  market: string;
  detail: string;
  tx?: string;
};

function shortAddress(value: string) {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "CONNECT";
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return <div className="chart-empty">Refresh the oracle to begin a live session chart.</div>;
  const width = 760;
  const height = 240;
  if (values.length === 1) {
    return (
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Current oracle price">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} className="chart-line" />
        <circle cx={width - 16} cy={height / 2} r="5" className="chart-dot" />
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, max * 0.001, 1);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 24) - 12;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Session oracle price chart">
      <polyline points={points} className="chart-line" />
    </svg>
  );
}

export default function Home() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [account, setAccount] = useState("");
  const [marketKey, setMarketKey] = useState<MarketKey>("ETH");
  const [side, setSide] = useState<"long" | "short">("long");
  const [leverage, setLeverage] = useState(3);
  const [margin, setMargin] = useState("500");
  const [collateralInput, setCollateralInput] = useState("1000");
  const [ethBalance, setEthBalance] = useState("0");
  const [walletUsdc, setWalletUsdc] = useState("0");
  const [vaultBalance, setVaultBalance] = useState("0");
  const [reserved, setReserved] = useState("0");
  const [oraclePrice, setOraclePrice] = useState("—");
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [position, setPosition] = useState<PositionView | null>(null);
  const [risk, setRisk] = useState<RiskView | null>(null);
  const [strategy, setStrategy] = useState("Max 3x leverage. Risk no more than 2% of collateral. Reduce exposure during extreme volatility.");
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const market = MARKETS[marketKey];
  const marketId = useMemo(() => id(market.symbol), [market.symbol]);
  const ready = contractsConfigured();

  async function ensureNetwork(ethereum: any) {
    const current = await ethereum.request({ method: "eth_chainId" });
    if (String(current).toLowerCase() === HORIZEN_TESTNET.chainHex.toLowerCase()) return;
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: HORIZEN_TESTNET.chainHex }]
      });
    } catch (error: any) {
      if (error?.code !== 4902) throw error;
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: HORIZEN_TESTNET.chainHex,
            chainName: HORIZEN_TESTNET.name,
            rpcUrls: [HORIZEN_TESTNET.rpcUrl],
            blockExplorerUrls: [HORIZEN_TESTNET.explorer],
            nativeCurrency: HORIZEN_TESTNET.nativeCurrency
          }
        ]
      });
    }
  }

  async function connect() {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      setStatus("No injected EVM wallet detected. Install MetaMask or another EVM wallet.");
      return;
    }
    try {
      setBusy(true);
      await ensureNetwork(ethereum);
      const nextProvider = new BrowserProvider(ethereum);
      const signer = await nextProvider.getSigner();
      const address = await signer.getAddress();
      setProvider(nextProvider);
      setAccount(address);
      setStatus("Connected to Horizen testnet");
      await refresh(nextProvider, address, marketKey);
    } catch (error: any) {
      setStatus(error?.shortMessage ?? error?.message ?? "Wallet connection failed");
    } finally {
      setBusy(false);
    }
  }

  async function refresh(activeProvider = provider, activeAccount = account, activeMarket: MarketKey = marketKey) {
    if (!activeProvider || !activeAccount) return;
    const eth = await activeProvider.getBalance(activeAccount);
    setEthBalance(Number(formatEther(eth)).toFixed(4));
    if (!ready) return;

    const token = new Contract(CONTRACTS.mockUSDC, ERC20_ABI, activeProvider);
    const vault = new Contract(CONTRACTS.vault, VAULT_ABI, activeProvider);
    const engine = new Contract(CONTRACTS.perpEngine, ENGINE_ABI, activeProvider);
    const oracle = new Contract(CONTRACTS.storkAdapter, ORACLE_ABI, activeProvider);
    const selected = MARKETS[activeMarket];
    const selectedMarketId = id(selected.symbol);

    const [wallet, deposited, locked] = await Promise.all([
      token.balanceOf(activeAccount),
      vault.collateral(activeAccount),
      vault.reservedMargin(activeAccount)
    ]);
    setWalletUsdc(formatUnits(wallet, 6));
    setVaultBalance(formatUnits(deposited, 6));
    setReserved(formatUnits(locked, 6));

    try {
      const [price] = await oracle.latestPrice(selected.feedId);
      const priceNumber = Number(formatUnits(price, 18));
      setOraclePrice(priceNumber.toLocaleString(undefined, { maximumFractionDigits: 2 }));
      setPriceHistory((previous) => [...previous.slice(-39), priceNumber]);
    } catch {
      setOraclePrice("needs update");
    }

    const raw = await engine.positions(activeAccount, selectedMarketId);
    if (raw.sizeUsd === 0n) {
      setPosition(null);
      return;
    }

    const [pnl, liquidation] = await Promise.all([
      engine.getUnrealizedPnl(activeAccount, selectedMarketId),
      engine.getLiquidationPrice(activeAccount, selectedMarketId)
    ]);
    setPosition({
      size: formatUnits(raw.sizeUsd, 6),
      margin: formatUnits(raw.margin, 6),
      entry: Number(formatUnits(raw.entryPrice, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      leverage: `${Number(raw.leverageBps) / 10_000}x`,
      side: raw.isLong ? "LONG" : "SHORT",
      pnl: formatUnits(pnl, 6),
      liquidation: Number(formatUnits(liquidation, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })
    });
  }

  async function runTx(label: string, action: () => Promise<any>) {
    if (!provider || !account || !ready) {
      setStatus(ready ? "Connect your wallet first" : "Contract addresses are not configured yet");
      return;
    }
    try {
      setBusy(true);
      setStatus(`${label}…`);
      const tx = await action();
      setStatus(`Waiting for ${shortAddress(tx.hash)}…`);
      await tx.wait();
      setStatus(`${label} confirmed`);
      await refresh();
      return tx.hash as string;
    } catch (error: any) {
      setStatus(error?.shortMessage ?? error?.reason ?? error?.message ?? `${label} failed`);
    } finally {
      setBusy(false);
    }
  }

  async function claimFaucet() {
    await runTx("Claiming 10,000 sUSDC", async () => {
      const signer = await provider!.getSigner();
      return new Contract(CONTRACTS.mockUSDC, ERC20_ABI, signer).faucet();
    });
  }

  async function approveVault() {
    await runTx("Approving vault", async () => {
      const signer = await provider!.getSigner();
      return new Contract(CONTRACTS.mockUSDC, ERC20_ABI, signer).approve(CONTRACTS.vault, MaxUint256);
    });
  }

  async function deposit() {
    const amount = parseUnits(collateralInput || "0", 6);
    await runTx("Depositing collateral", async () => {
      const signer = await provider!.getSigner();
      return new Contract(CONTRACTS.vault, VAULT_ABI, signer).deposit(amount);
    });
  }

  async function withdraw() {
    const amount = parseUnits(collateralInput || "0", 6);
    await runTx("Withdrawing collateral", async () => {
      const signer = await provider!.getSigner();
      return new Contract(CONTRACTS.vault, VAULT_ABI, signer).withdraw(amount);
    });
  }

  async function pushOracle(): Promise<bigint> {
    if (!provider || !account || !ready) throw new Error("Connect wallet and configure contracts first");
    setStatus(`Fetching signed ${market.asset} update…`);
    const response = await fetch(`/api/stork-price?asset=${market.asset}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Stork request failed");

    const updates = body.updateData.map((entry: any) => ({
      ...entry,
      temporalNumericValue: {
        timestampNs: BigInt(entry.temporalNumericValue.timestampNs),
        quantizedValue: BigInt(entry.temporalNumericValue.quantizedValue)
      },
      v: Number(entry.v)
    }));

    const signer = await provider.getSigner();
    const oracle = new Contract(CONTRACTS.storkAdapter, ORACLE_ABI, signer);
    const fee = await oracle.getUpdateFee(updates);
    const tx = await oracle.updatePrices(updates, { value: fee });
    setStatus(`Updating Stork on Horizen ${shortAddress(tx.hash)}…`);
    await tx.wait();
    const [price] = await oracle.latestPrice(market.feedId);
    const priceNumber = Number(formatUnits(price, 18));
    setOraclePrice(priceNumber.toLocaleString(undefined, { maximumFractionDigits: 2 }));
    setPriceHistory((previous) => [...previous.slice(-39), priceNumber]);
    return price;
  }

  async function refreshOracle() {
    if (!provider || busy) return;
    try {
      setBusy(true);
      await pushOracle();
      setStatus("Oracle fresh");
      await refresh();
    } catch (error: any) {
      setStatus(error?.shortMessage ?? error?.message ?? "Oracle update failed");
    } finally {
      setBusy(false);
    }
  }

  async function openTrade() {
    if (!provider || !account || !ready || busy) return;
    try {
      setBusy(true);
      const price = await pushOracle();
      const marginAmount = parseUnits(margin || "0", 6);
      const leverageBps = leverage * 10_000;
      const limit = side === "long" ? (price * 10_050n) / 10_000n : (price * 9_950n) / 10_000n;
      const signer = await provider.getSigner();
      const engine = new Contract(CONTRACTS.perpEngine, ENGINE_ABI, signer);
      const tx = await engine.openPosition(marketId, side === "long", marginAmount, leverageBps, limit);
      setStatus(`Opening ${side.toUpperCase()} ${shortAddress(tx.hash)}…`);
      await tx.wait();
      setHistory((items) => [
        { time: new Date().toLocaleTimeString(), action: "OPEN", market: market.symbol, detail: `${side.toUpperCase()} · ${leverage}x · ${margin} USDC margin`, tx: tx.hash },
        ...items
      ]);
      setStatus("Position opened on Horizen testnet");
      await refresh();
    } catch (error: any) {
      setStatus(error?.shortMessage ?? error?.reason ?? error?.message ?? "Open position failed");
    } finally {
      setBusy(false);
    }
  }

  async function closeTrade() {
    if (!provider || !position || busy) return;
    try {
      setBusy(true);
      const price = await pushOracle();
      const isLong = position.side === "LONG";
      const limit = isLong ? (price * 9_950n) / 10_000n : (price * 10_050n) / 10_000n;
      const signer = await provider.getSigner();
      const engine = new Contract(CONTRACTS.perpEngine, ENGINE_ABI, signer);
      const tx = await engine.closePosition(marketId, 10_000, limit);
      setStatus(`Closing position ${shortAddress(tx.hash)}…`);
      await tx.wait();
      setHistory((items) => [
        { time: new Date().toLocaleTimeString(), action: "CLOSE", market: market.symbol, detail: `Full close · PnL before close ${position.pnl} USDC`, tx: tx.hash },
        ...items
      ]);
      setStatus("Position closed and PnL settled");
      await refresh();
    } catch (error: any) {
      setStatus(error?.shortMessage ?? error?.reason ?? error?.message ?? "Close position failed");
    } finally {
      setBusy(false);
    }
  }

  async function analyzeRisk() {
    const price = Number(String(oraclePrice).replaceAll(",", "")) || 0;
    const response = await fetch("/api/risk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        collateral: Number(vaultBalance),
        margin: Number(margin),
        leverage,
        price,
        side,
        volatilityPct: marketKey === "BTC" ? 4.5 : 3.5,
        fundingBpsPerDay: 0
      })
    });
    const body = await response.json();
    if (response.ok) setRisk(body);
    else setStatus(body.error ?? "Risk analysis failed");
  }

  async function commitStrategy() {
    if (!provider || !account || !ready || !strategy.trim()) return;
    const commitment = keccak256(toUtf8Bytes(strategy.trim()));
    const txHash = await runTx("Committing private strategy hash", async () => {
      const signer = await provider.getSigner();
      return new Contract(CONTRACTS.intents, INTENT_ABI, signer).submitIntent(commitment);
    });
    if (txHash) {
      setHistory((items) => [
        { time: new Date().toLocaleTimeString(), action: "PRIVATE", market: market.symbol, detail: `Strategy commitment ${commitment.slice(0, 12)}…`, tx: txHash },
        ...items
      ]);
    }
  }

  async function selectMarket(next: MarketKey) {
    setMarketKey(next);
    setPriceHistory([]);
    setRisk(null);
    if (provider && account) await refresh(provider, account, next);
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">S</span><span>SYMBASIS</span></div>
        <nav><span className="active">TRADE</span><span>PORTFOLIO</span><span>PRIVATE AGENT</span></nav>
        <div className="network"><span className="signal" /> HORIZEN TESTNET</div>
        <button className="wallet" onClick={connect} disabled={busy}>{account ? shortAddress(account) : "CONNECT WALLET"}</button>
      </header>

      {!ready && (
        <div className="deploy-warning">
          CONTRACTS NOT DEPLOYED / CONFIGURED — the interface is built, but live actions activate after the Horizen testnet deployment addresses are added.
        </div>
      )}

      <section className="ticker">
        <div><span>ETH-PERP</span><strong>${marketKey === "ETH" ? oraclePrice : "—"}</strong></div>
        <div><span>BTC-PERP</span><strong>${marketKey === "BTC" ? oraclePrice : "—"}</strong></div>
        <div><span>COLLATERAL</span><strong>{Number(vaultBalance).toLocaleString()} sUSDC</strong></div>
        <div><span>RESERVED</span><strong>{Number(reserved).toLocaleString()} sUSDC</strong></div>
        <div><span>GAS</span><strong>{ethBalance} ETH</strong></div>
      </section>

      <section className="workspace">
        <div className="market-column">
          <div className="panel market-panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">PERPETUAL MARKET</div>
                <div className="market-title">
                  <button className={marketKey === "ETH" ? "market-chip selected" : "market-chip"} onClick={() => selectMarket("ETH")}>ETH</button>
                  <button className={marketKey === "BTC" ? "market-chip selected" : "market-chip"} onClick={() => selectMarket("BTC")}>BTC</button>
                  <span>{market.symbol}</span>
                </div>
              </div>
              <div className="price-box"><span>STORK MARK</span><strong>${oraclePrice}</strong><button onClick={refreshOracle} disabled={!account || busy}>REFRESH</button></div>
            </div>
            <Sparkline values={priceHistory} />
            <div className="chart-footer"><span>SESSION ORACLE TRACE</span><span>STORK · 18 DECIMALS · MAX AGE 120S</span></div>
          </div>

          <div className="panel position-panel">
            <div className="panel-head"><div><div className="eyebrow">OPEN POSITION</div><h2>{position ? `${position.side} ${market.symbol}` : "NO ACTIVE POSITION"}</h2></div>{position && <button className="danger ghost" onClick={closeTrade} disabled={busy}>CLOSE 100%</button>}</div>
            {position ? (
              <div className="metrics five">
                <div><span>SIZE</span><strong>${Number(position.size).toLocaleString()}</strong></div>
                <div><span>MARGIN</span><strong>${Number(position.margin).toLocaleString()}</strong></div>
                <div><span>ENTRY</span><strong>${position.entry}</strong></div>
                <div><span>LIQ. PRICE</span><strong>${position.liquidation}</strong></div>
                <div><span>UNREALIZED PNL</span><strong className={Number(position.pnl) >= 0 ? "positive" : "negative"}>{Number(position.pnl) >= 0 ? "+" : ""}{Number(position.pnl).toFixed(2)}</strong></div>
              </div>
            ) : <p className="muted">Deposit test collateral and open a market position. Margin is reserved in the vault until the position is reduced or closed.</p>}
          </div>

          <div className="panel history-panel">
            <div className="panel-head"><div><div className="eyebrow">ACTIVITY</div><h2>SESSION TRADE HISTORY</h2></div></div>
            {history.length ? history.map((item, index) => (
              <div className="history-row" key={`${item.time}-${index}`}>
                <span>{item.time}</span><b>{item.action}</b><span>{item.market}</span><span className="history-detail">{item.detail}</span>
                {item.tx ? <a href={`${HORIZEN_TESTNET.explorer}/tx/${item.tx}`} target="_blank" rel="noreferrer">TX ↗</a> : null}
              </div>
            )) : <p className="muted">Confirmed actions from this browser session will appear here. Every trade also emits onchain events for later indexing.</p>}
          </div>
        </div>

        <aside className="side-column">
          <div className="panel order-panel">
            <div className="side-toggle"><button className={side === "long" ? "long active-side" : "long"} onClick={() => setSide("long")}>LONG</button><button className={side === "short" ? "short active-side" : "short"} onClick={() => setSide("short")}>SHORT</button></div>
            <label>MARGIN <span>AVAILABLE {Math.max(0, Number(vaultBalance) - Number(reserved)).toFixed(2)}</span></label>
            <div className="input-row"><input value={margin} onChange={(event) => setMargin(event.target.value)} inputMode="decimal" /><span>sUSDC</span></div>
            <label>LEVERAGE <span>{leverage}×</span></label>
            <input className="range" type="range" min="1" max="10" value={leverage} onChange={(event) => setLeverage(Number(event.target.value))} />
            <div className="leverage-marks"><span>1×</span><span>3×</span><span>5×</span><span>10×</span></div>
            <div className="order-summary"><div><span>POSITION SIZE</span><strong>${(Number(margin || 0) * leverage).toLocaleString()}</strong></div><div><span>MAX SLIPPAGE</span><strong>0.50%</strong></div><div><span>MODE</span><strong>ISOLATED</strong></div></div>
            <button className={side === "long" ? "primary long-btn" : "primary short-btn"} onClick={openTrade} disabled={!account || !ready || busy || !!position}>{position ? "CLOSE CURRENT POSITION FIRST" : `OPEN ${side.toUpperCase()}`}</button>
          </div>

          <div className="panel ai-panel">
            <div className="eyebrow">SYMBASIS AI / DECISION SUPPORT</div>
            <div className="ai-title"><h2>PRE-TRADE RISK</h2>{risk && <span className={`risk ${risk.level.toLowerCase()}`}>{risk.score}/100 {risk.level}</span>}</div>
            {risk ? <>
              <div className="metrics three"><div><span>REC. LEVERAGE</span><strong>{risk.recommendedLeverage}×</strong></div><div><span>SUGGESTED MARGIN</span><strong>${risk.suggestedMargin}</strong></div><div><span>LIQ. BUFFER</span><strong>{risk.liquidationDistance}</strong></div></div>
              <ul>{risk.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </> : <p className="muted">Explainable baseline analysis. It recommends risk parameters but cannot sign transactions or control your funds.</p>}
            <button className="secondary" onClick={analyzeRisk}>ANALYZE TRADE</button>
          </div>

          <div className="panel collateral-panel">
            <div className="eyebrow">TESTNET COLLATERAL</div><h2>sUSDC VAULT</h2>
            <div className="metrics three"><div><span>WALLET</span><strong>{Number(walletUsdc).toLocaleString()}</strong></div><div><span>DEPOSITED</span><strong>{Number(vaultBalance).toLocaleString()}</strong></div><div><span>RESERVED</span><strong>{Number(reserved).toLocaleString()}</strong></div></div>
            <div className="input-row"><input value={collateralInput} onChange={(event) => setCollateralInput(event.target.value)} inputMode="decimal" /><span>sUSDC</span></div>
            <div className="button-grid"><button className="secondary" onClick={claimFaucet} disabled={!account || busy}>FAUCET</button><button className="secondary" onClick={approveVault} disabled={!account || busy}>APPROVE</button><button className="secondary" onClick={deposit} disabled={!account || busy}>DEPOSIT</button><button className="secondary" onClick={withdraw} disabled={!account || busy}>WITHDRAW</button></div>
            <a className="faucet-link" href={HORIZEN_TESTNET.faucet} target="_blank" rel="noreferrer">GET HORIZEN TESTNET ETH ↗</a>
          </div>

          <div className="panel privacy-panel">
            <div className="eyebrow">CONFIDENTIAL INTENT / VELA-READY</div><h2>PRIVATE AGENT MANDATE</h2>
            <textarea value={strategy} onChange={(event) => setStrategy(event.target.value)} rows={4} />
            <p className="muted">The raw mandate stays in this browser. Only its keccak256 commitment is submitted onchain. VELA execution is integrated separately in the supported local environment while shared testnet deployment remains unavailable.</p>
            <button className="secondary" onClick={commitStrategy} disabled={!account || busy}>COMMIT STRATEGY HASH</button>
          </div>
        </aside>
      </section>

      <footer><span>{status}</span><span>CHAIN ID {HORIZEN_TESTNET.chainId} · TESTNET ONLY · NOT FOR REAL FUNDS</span></footer>
    </main>
  );
}
