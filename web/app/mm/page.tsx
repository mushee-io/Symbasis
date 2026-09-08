"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MMMarketKey, MMSnapshot } from "@/lib/mm/engine";
import styles from "./mm.module.css";

type MMResponse = {
  ok: boolean;
  mode?: string;
  settlementOracle?: string;
  snapshot?: MMSnapshot;
  error?: string;
};

function money(value: number, market: MMMarketKey) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: market === "BTC" ? 1 : 1,
    maximumFractionDigits: market === "BTC" ? 1 : 2
  });
}

function size(value: number, market: MMMarketKey) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: market === "BTC" ? 4 : 3,
    maximumFractionDigits: market === "BTC" ? 4 : 3
  });
}

function time(value: number) {
  return new Date(value).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function PriceChart({ values }: { values: number[] }) {
  const width = 900;
  const height = 300;
  if (values.length < 2) return <div className={styles.empty}>Building the market trace…</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, max * 0.00025, 0.01);
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - 12 - ((value - min) / range) * (height - 24);
    return `${x},${y}`;
  }).join(" ");
  const last = values[values.length - 1];
  const lastX = width;
  const lastY = height - 12 - ((last - min) / range) * (height - 24);

  return (
    <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Symbasis MM simulated price trace">
      {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
        <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} className={styles.chartGrid} />
      ))}
      <polyline points={points} className={styles.chartLine} />
      <circle cx={lastX - 3} cy={lastY} r="4" className={styles.chartDot} />
    </svg>
  );
}

export default function MarketMakerPage() {
  const [market, setMarket] = useState<MMMarketKey>("ETH");
  const [snapshot, setSnapshot] = useState<MMSnapshot | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/mm?market=${market}&levels=12&trades=18`, { cache: "no-store" });
      const body = await response.json() as MMResponse;
      if (!response.ok || !body.ok || !body.snapshot) throw new Error(body.error ?? "MM feed unavailable");
      setSnapshot(body.snapshot);
      setHistory((previous) => [...previous.slice(-119), body.snapshot!.markPrice]);
      setConnected(true);
      setError("");
    } catch (cause) {
      setConnected(false);
      setError(cause instanceof Error ? cause.message : "MM feed unavailable");
    }
  }, [market]);

  useEffect(() => {
    setSnapshot(null);
    setHistory([]);
    void load();
    const timer = window.setInterval(() => void load(), 1_250);
    return () => window.clearInterval(timer);
  }, [load]);

  const visibleAsks = useMemo(() => snapshot ? snapshot.asks.slice(0, 8).reverse() : [], [snapshot]);
  const visibleBids = useMemo(() => snapshot ? snapshot.bids.slice(0, 8) : [], [snapshot]);
  const trades = snapshot?.trades.slice(0, 16) ?? [];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}><span className={styles.mark}>S</span><span>SYMBASIS MM</span></div>
        <div className={styles.badge}><span className={styles.liveDot} />{connected ? "SIMULATION LIVE" : "RECONNECTING"}</div>
      </header>

      <div className={styles.shell}>
        <section className={styles.toolbar}>
          <div>
            <div className={styles.kicker}>HORIZEN TESTNET · MARKET LIQUIDITY SIMULATOR</div>
            <h1 className={styles.title}>MAKE THE MARKET MOVE.</h1>
          </div>
          <div className={styles.switcher}>
            {(["ETH", "BTC"] as MMMarketKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setMarket(key)}
                className={`${styles.button} ${market === key ? styles.buttonActive : ""}`}
              >
                {key}-PERP
              </button>
            ))}
          </div>
        </section>

        {error ? <div className={styles.error}>{error}</div> : null}

        <section className={styles.metricGrid}>
          <div className={styles.card}><span>MM MARK</span><strong>{snapshot ? `$${money(snapshot.markPrice, market)}` : "—"}</strong></div>
          <div className={styles.card}><span>INDEX</span><strong>{snapshot ? `$${money(snapshot.indexPrice, market)}` : "—"}</strong></div>
          <div className={styles.card}><span>BEST BID</span><strong className={styles.bid}>{snapshot ? `$${money(snapshot.bestBid, market)}` : "—"}</strong></div>
          <div className={styles.card}><span>BEST ASK</span><strong className={styles.ask}>{snapshot ? `$${money(snapshot.bestAsk, market)}` : "—"}</strong></div>
          <div className={styles.card}><span>SPREAD</span><strong>{snapshot ? `${snapshot.spreadBps.toFixed(2)} bps` : "—"}</strong></div>
          <div className={styles.card}><span>24H SIM</span><strong className={(snapshot?.change24hPct ?? 0) >= 0 ? styles.positive : styles.negative}>{snapshot ? `${snapshot.change24hPct >= 0 ? "+" : ""}${snapshot.change24hPct.toFixed(2)}%` : "—"}</strong></div>
        </section>

        <section className={styles.mainGrid}>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <div><span>MARKET TRACE</span></div>
              <strong>{snapshot?.symbol ?? `${market}-PERP`} · {snapshot?.regime ?? "BOOTING"}</strong>
            </div>
            <div className={styles.chartWrap}><PriceChart values={history} /></div>
            <div className={styles.priceHero}>
              <strong>{snapshot ? `$${money(snapshot.markPrice, market)}` : "—"}</strong>
              <div className={styles.regime}>REGIME / {snapshot?.regime ?? "—"}</div>
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHead}><span>ORDER BOOK</span><strong>12 LEVELS / SIDE</strong></div>
            <div className={styles.bookTable}>
              <div className={styles.tableHead}><span>PRICE</span><span>SIZE</span><span>TOTAL</span></div>
              {visibleAsks.map((level) => (
                <div className={styles.row} key={`ask-${level.price}`}>
                  <span className={styles.ask}>{money(level.price, market)}</span><span>{size(level.size, market)}</span><span>{size(level.cumulativeSize, market)}</span>
                </div>
              ))}
              <div className={styles.midRow}>
                <span>{snapshot ? `$${money(snapshot.midPrice, market)}` : "—"}</span>
                <span>{snapshot ? `${snapshot.spreadBps.toFixed(2)} BPS` : "—"}</span>
              </div>
              {visibleBids.map((level) => (
                <div className={styles.row} key={`bid-${level.price}`}>
                  <span className={styles.bid}>{money(level.price, market)}</span><span>{size(level.size, market)}</span><span>{size(level.cumulativeSize, market)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.bottomGrid}>
          <div className={styles.panel}>
            <div className={styles.panelHead}><span>TRADE TAPE</span><strong>SIMULATED FLOW</strong></div>
            <div className={styles.tradeTable}>
              <div className={`${styles.tableHead} ${styles.tradeRow}`}><span>TIME</span><span>PRICE</span><span>SIZE</span></div>
              {trades.map((trade) => (
                <div className={`${styles.row} ${styles.tradeRow}`} key={trade.id}>
                  <span>{time(trade.timestamp)}</span>
                  <span className={trade.side === "BUY" ? styles.bid : styles.ask}>{trade.side} · {money(trade.price, market)}</span>
                  <span>{size(trade.size, market)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHead}><span>MM TELEMETRY</span><strong>ENGINE STATE</strong></div>
            <div className={styles.bookTable}>
              <div className={styles.row}><span>SEQUENCE</span><span /><span>{snapshot?.sequence ?? "—"}</span></div>
              <div className={styles.row}><span>REFERENCE</span><span /><span>{snapshot ? `$${money(snapshot.referencePrice, market)}` : "—"}</span></div>
              <div className={styles.row}><span>VOLATILITY</span><span /><span>{snapshot ? `${snapshot.volatilityPct.toFixed(2)}%` : "—"}</span></div>
              <div className={styles.row}><span>REGIME</span><span /><span>{snapshot?.regime ?? "—"}</span></div>
              <div className={styles.row}><span>REFRESH</span><span /><span>1.25 SEC</span></div>
              <div className={styles.row}><span>EXECUTION</span><span /><span>TESTNET SIM</span></div>
              <div className={styles.row}><span>SETTLEMENT ORACLE</span><span /><span>STORK</span></div>
              <div className={styles.row}><span>NETWORK</span><span /><span>HORIZEN TESTNET</span></div>
            </div>
          </div>
        </section>

        <footer className={styles.footer}>
          <span>SYMBASIS MM generates deterministic test liquidity, spreads, depth and trade flow. It does not represent real exchange liquidity.</span>
          <span>ONCHAIN POSITION SETTLEMENT REMAINS STORK-PRICED.</span>
        </footer>
      </div>
    </main>
  );
}
