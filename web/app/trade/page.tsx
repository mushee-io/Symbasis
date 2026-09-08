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
import { useEffect, useMemo, useState } from "react";
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

function errorMessage(error: unknown, fallback: string) {
  const err = error as { code?: number; shortMessage?: string; reason?: string; message?: string };
  if (err?.code === 4001) return "Action rejected in wallet";
  const message = err?.shortMessage ?? err?.reason ?? err?.message ?? fallback;
  if (message.includes("user rejected")) return "Action rejected in wallet";
  if (message.includes("network changed")) return "Wallet network changed. Reconnect to Horizen testnet.";
  return message.length > 220 ? `${message.slice(0, 217)}…` : message;
}

function parseAmount6(value: string, label: string) {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{0,6})?$/.test(trimmed)) {
    throw new Error(`${label} must be a positive number with at most 6 decimals`);
  }
  const amount = parseUnits(trimmed, 6);
  if (amount <= 0n) throw new Error(`${label} must be greater than zero`);
  if (amount > parseUnits("1000000000", 6)) throw new Error(`${label} is outside testnet limits`);
  return amount;
}

function safeNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
  const freeCollateral = Math.max(0, safeNumber(vaultBalance) - safeNumber(reserved));
  const displayMargin = safeNumber(margin);

  function clearWalletState(message: string) {
    setProvider(null);
    setAccount("");
    setEthBalance("0");
    setWalletUsdc("0");
    setVaultBalance("0");
    setReserved("0");
    setPosition(null);
    setRisk(null);
    setStatus(message);
  }

  useEffect(() => {
    const ethereum = (window as any).ethereum;
    if (!ethereum?.on) return;

    const onAccountsChanged = async (accounts: string[]) => {
      if (!accounts.length) {
        clearWalletState("Wallet disconnected");
        return;
      }
      try {
        const chainId = await ethereum.request({ method: "eth_chainId" });
        if (String(chainId).toLowerCase() !== HORIZEN_TESTNET.chainHex.toLowerCase()) {
          clearWalletState("Wallet account changed on the wrong network. Reconnect to Horizen testnet.");
          return;
        }
        const nextProvider = new BrowserProvider(ethereum);
        setProvider(nextProvider);
        setAccount(accounts[0]);
        setStatus("Wallet account changed");
        await refresh(nextProvider, accounts[0], marketKey);
      } catch (error) {
        clearWalletState(errorMessage(error, "Could not refresh changed wallet account"));
      }
    };

    const onChainChanged = async (chainId: string) => {
      if (String(chainId).toLowerCase() !== HORIZEN_TESTNET.chainHex.toLowerCase()) {
        clearWalletState("Wrong network. Switch back to Horizen testnet and reconnect.");
        return;
      }
      try {
        const nextProvider = new BrowserProvider(ethereum);
        const signer = await nextProvider.getSigner();
        const address = await signer.getAddress();
        setProvider(nextProvider);
        setAccount(address);
        setStatus("Reconnected to Horizen testnet");
        await refresh(nextProvider, address, marketKey);
      } catch (error) {
        clearWalletState(errorMessage(error, "Could not reconnect after network change"));
      }
    };

    ethereum.on("accountsChanged", onAccountsChanged);
    ethereum.on("chainChanged", onChainChanged);
    return () => {
      ethereum.removeListener?.("accountsChanged", onAccountsChanged);
      ethereum.removeListener?.("chainChanged", onChainChanged);
    };
  }, [marketKey]);

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

  async function assertNetwork() {
    const ethereum = (window as any).ethereum;
    if (!ethereum) throw new Error("No injected EVM wallet detected");
    const chainId = await ethereum.request({ method: "eth_chainId" });
    if (String(chainId).toLowerCase() !== HORIZEN_TESTNET.chainHex.toLowerCase()) {
      throw new Error("Wrong network. Switch to Horizen testnet before transacting.");
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
    } catch (error) {
      setStatus(errorMessage(error, "Wallet connection failed"));
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
      await assertNetwork();
      setStatus(`${label}…`);
      const tx = await action();
      setStatus(`Waiting for ${shortAddress(tx.hash)}…`);
      await tx.wait();
      setStatus(`${label} confirmed`);
      await refresh();
      return tx.hash as string;
    } catch (error) {
      setStatus(errorMessage(error, `${label} failed`));
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
    try {
      const amount = parseAmount6(collateralInput, "Deposit amount");
      if (amount > parseUnits(walletUsdc || "0", 6)) throw new Error("Deposit exceeds wallet sUSDC balance");
      await runTx("Depositing collateral", async () => {
        const signer = await provider!.getSigner();
        return new Contract(CONTRACTS.vault, VAULT_ABI, signer).deposit(amount);
      });
    } catch (error) {
      setStatus(errorMessage(error, "Deposit validation failed"));
    }
  }

  async function withdraw() {
    try {
      const amount = parseAmount6(collateralInput, "Withdrawal amount");
      const free = parseUnits(freeCollateral.toFixed(6), 6);
      if (amount > free) throw new Error("Withdrawal exceeds free collateral after reserved margin");
      await runTx("Withdrawing collateral", async () => {
        const signer = await provider!.getSigner();
        return new Contract(CONTRACTS.vault, VAULT_ABI, signer).withdraw(amount);
      });
    } catch (error) {
      setStatus(errorMessage(error, "Withdrawal validation failed"));
    }
  }

  async function pushOracle(): Promise<bigint> {
    if (!provider || !account || !ready) throw new Error("Connect wallet and configure contracts first");
    await assertNetwork();
    setStatus(`Fetching signed ${market.asset} update…`);
    const response = await fetch(`/api/stork-price?asset=${market.asset}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Stork request failed");
    if (!Array.isArray(body.updateData) || body.updateData.length !== 1) throw new Error("Invalid Stork update payload");

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
    } catch (error) {
      setStatus(errorMessage(error, "Oracle update failed"));
    } finally {
      setBusy(false);
    }
  }

  async function openTrade() {
    if (!provider || !account || !ready || busy) return;
    try {
      setBusy(true);
      const marginAmount = parseAmount6(margin, "Trade margin");
      const free = parseUnits(freeCollateral.toFixed(6), 6);
      if (marginAmount > free) throw new Error("Trade margin exceeds free deposited collateral");
      if (!Number.isInteger(leverage) || leverage < 1 || leverage > 10) throw new Error("Leverage must be between 1x and 10x");

      const price = await pushOracle();
      const leverageBps = leverage * 10_000;
      const limit = side === "long" ? (price * 10_050n) / 10_000n : (price * 9_950n) / 10_000n;
      const signer = await provider.getSigner();
      const engine = new Contract(CONTRACTS.perpEngine, ENGINE_ABI, signer);
      const tx = await engine.openPosition(marketId, side === "long", marginAmount, leverageBps, limit);
      setStatus(`Opening ${side.toUpperCase()} ${shortAddress(tx.hash)}…`);
      await tx.wait();
      setHistory((items) => [
        { time: new Date().toLocaleTimeString(), action: "OPEN", market: market.symbol, detail: `${side.toUpperCase()} · ${leverage}x · ${margin} sUSDC margin`, tx: tx.hash },
        ...items
      ]);
      setStatus("Position opened on Horizen testnet");
      await refresh();
    } catch (error) {
      setStatus(errorMessage(error, "Open position failed"));
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
        { time: new Date().toLocaleTimeString(), action: "CLOSE", market: market.symbol, detail: `Full close · PnL before close ${position.pnl} sUSDC`, tx: tx.hash },
        ...items
      ]);
      setStatus("Position closed and PnL settled");
      await refresh();
    } catch (error) {
      setStatus(errorMessage(error, "Close position failed"));
    } finally {
      setBusy(false);
    }
  }

  async function analyzeRisk() {
    try {
      const price = Number(String(oraclePrice).replaceAll(",", "")) || 0;
      const marginValue = safeNumber(margin);
      if (marginValue <= 0) throw new Error("Enter a valid trade margin before analysis");
      const response = await fetch("/api/risk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          collateral: safeNumber(vaultBalance),
          margin: marginValue,
          leverage,
          price,
          side,
          volatilityPct: marketKey === "BTC" ? 4.5 : 3.5,
          fundingBpsPerDay: 0
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Risk analysis failed");
      setRisk(body);
      setStatus("Risk analysis updated");
    } catch (error) {
      setStatus(errorMessage(error, "Risk analysis failed"));
    }
  }

  async function commitStrategy() {
    const trimmed = strategy.trim();
    if (!provider || !account || !ready || !trimmed) return;
    if (trimmed.length > 2_000) {
      setStatus("Private mandate is too long; keep it under 2,000 characters");
      return;
    }
    const commitment = keccak256(toUtf8Bytes(trimmed));
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
    if (provider && account) {
      try {
        await refresh(provider, account, next);
      } catch (error) {
        setStatus(errorMessage(error, "Could not load selected market"));
      }
    }
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
        <div><span>COLLATERAL</span><strong>{safeNumber(vaultBalance).toLocaleString()} sUSDC</strong></div>
        <div><span>RESERVED</span><strong>{safeNumber(reserved).toLocaleString()} sUSDC</strong></div>
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
                <div><span>SIZE</span><strong>${safeNumber(position.size).toLocaleString()}</strong></div>
                <div><span>MARGIN</span><strong>${safeNumber(position.margin).toLocaleString()}</strong></div>
                <div><span>ENTRY</span><strong>${position.entry}</strong></div>
                <div><span>LIQ. PRICE</span><strong>${position.liquidation}</strong></div>
                <div><span>UNREALIZED PNL</span><strong className={safeNumber(position.pnl) >= 0 ? "positive" : "negative"}>{safeNumber(position.pnl) >= 0 ? "+" : ""}{safeNumber(position.pnl).toFixed(2)}</strong></div>
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
            <label>MARGIN <span>AVAILABLE {freeCollateral.toFixed(2)}</span></label>
            <div className="input-row"><input value={margin} onChange={(event) => setMargin(event.target.value)} inputMode="decimal" aria-label="Trade margin" /><span>sUSDC</span></div>
            <label>LEVERAGE <span>{leverage}×</span></label>
            <input className="range" type="range" min="1" max="10" value={leverage} onChange={(event) => setLeverage(Number(event.target.value))} aria-label="Leverage" />
            <div className="leverage-marks"><span>1×</span><span>3×</span><span>5×</span><span>10×</span></div>
            <div className="order-summary"><div><span>POSITION SIZE</span><strong>${(displayMargin * leverage).toLocaleString()}</strong></div><div><span>MAX SLIPPAGE</span><strong>0.50%</strong></div><div><span>MODE</span><strong>ISOLATED</strong></div></div>
            <button className={side === "long" ? "primary long-btn" : "primary short-btn"} onClick={openTrade} disabled={!account || !ready || busy || !!position}>{position ? "CLOSE CURRENT POSITION FIRST" : `OPEN ${side.toUpperCase()}`}</button>
          </div>

          <div className="panel ai-panel">
            <div className="eyebrow">SYMBASIS AI / DECISION SUPPORT</div>
            <div className="ai-title"><h2>PRE-TRADE RISK</h2>{risk && <span className={`risk ${risk.level.toLowerCase()}`}>{risk.score}/100 {risk.level}</span>}</div>
            {risk ? <>
              <div className="metrics three"><div><span>REC. LEVERAGE</span><strong>{risk.recommendedLeverage}×</strong></div><div><span>SUGGESTED MARGIN</span><strong>${risk.suggestedMargin}</strong></div><div><span>LIQ. BUFFER</span><strong>{risk.liquidationDistance}</strong></div></div>
              <ul>{risk.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </> : <p className="muted">Explainable baseline analysis. It recommends risk parameters but cannot sign transactions or control your funds.</p>}
            <button className="secondary" onClick={analyzeRisk} disabled={busy}>ANALYZE TRADE</button>
          </div>

          <div className="panel collateral-panel">
            <div className="eyebrow">TESTNET COLLATERAL</div><h2>sUSDC VAULT</h2>
            <div className="metrics three"><div><span>WALLET</span><strong>{safeNumber(walletUsdc).toLocaleString()}</strong></div><div><span>DEPOSITED</span><strong>{safeNumber(vaultBalance).toLocaleString()}</strong></div><div><span>RESERVED</span><strong>{safeNumber(reserved).toLocaleString()}</strong></div></div>
            <div className="input-row"><input value={collateralInput} onChange={(event) => setCollateralInput(event.target.value)} inputMode="decimal" aria-label="Collateral amount" /><span>sUSDC</span></div>
            <div className="button-grid"><button className="secondary" onClick={claimFaucet} disabled={!account || busy}>FAUCET</button><button className="secondary" onClick={approveVault} disabled={!account || busy}>APPROVE</button><button className="secondary" onClick={deposit} disabled={!account || busy}>DEPOSIT</button><button className="secondary" onClick={withdraw} disabled={!account || busy}>WITHDRAW</button></div>
            <a className="faucet-link" href={HORIZEN_TESTNET.faucet} target="_blank" rel="noreferrer">GET HORIZEN TESTNET ETH ↗</a>
          </div>

          <div className="panel privacy-panel">
            <div className="eyebrow">CONFIDENTIAL INTENT / VELA-READY</div><h2>PRIVATE AGENT MANDATE</h2>
            <textarea value={strategy} onChange={(event) => setStrategy(event.target.value)} rows={4} maxLength={2000} />
            <p className="muted">The raw mandate stays in this browser. Only its keccak256 commitment is submitted onchain. VELA execution is integrated separately in the supported local environment while shared testnet deployment remains unavailable.</p>
            <button className="secondary" onClick={commitStrategy} disabled={!account || busy || !strategy.trim()}>COMMIT STRATEGY HASH</button>
          </div>
        </aside>
      </section>

      <footer><span>{status}</span><span>CHAIN ID {HORIZEN_TESTNET.chainId} · TESTNET ONLY · NOT FOR REAL FUNDS</span></footer>
    </main>
  );
}
