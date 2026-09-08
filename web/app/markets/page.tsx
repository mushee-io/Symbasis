"use client";

import { useEffect, useState } from "react";
import TerminalNav from "@/components/TerminalNav";
import type { MMSnapshot } from "@/lib/mm/engine";

type MMResponse = { ok: boolean; snapshot?: MMSnapshot };

export default function MarketsPage() {
  const [eth, setEth] = useState<MMSnapshot | null>(null);
  const [btc, setBtc] = useState<MMSnapshot | null>(null);

  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const [ethRes, btcRes] = await Promise.all([
          fetch("/api/mm?market=ETH&levels=8&trades=6", { cache: "no-store" }),
          fetch("/api/mm?market=BTC&levels=8&trades=6", { cache: "no-store" })
        ]);
        const [ethBody, btcBody] = await Promise.all([ethRes.json() as Promise<MMResponse>, btcRes.json() as Promise<MMResponse>]);
        if (!live) return;
        if (ethBody.ok && ethBody.snapshot) setEth(ethBody.snapshot);
        if (btcBody.ok && btcBody.snapshot) setBtc(btcBody.snapshot);
      } catch {}
    }
    void load();
    const timer = window.setInterval(() => void load(), 2_000);
    return () => { live = false; window.clearInterval(timer); };
  }, []);

  const rows = [eth, btc].filter(Boolean) as MMSnapshot[];

  return (
    <main className="terminal-page">
      <TerminalNav />
      <div className="terminal-shell">
        <section className="terminal-header">
          <div><div className="terminal-kicker">02 / MARKET STRUCTURE</div><h1>MARKETS</h1></div>
          <p>Compact perpetual market telemetry. Prices and book-derived statistics are testnet simulation data until the production oracle/execution path is enabled.</p>
        </section>
        <section className="metric-ribbon">
          <div><span>ACTIVE MARKETS</span><strong>02</strong></div>
          <div><span>NETWORK</span><strong>HORIZEN</strong></div>
          <div><span>ENGINE</span><strong>ONLINE</strong></div>
          <div><span>ORACLE MODE</span><strong>DEMO</strong></div>
          <div><span>SETTLEMENT</span><strong>ONCHAIN</strong></div>
        </section>
        <section className="page-grid single">
          <div className="data-region">
            <div className="filter-row"><input aria-label="Search markets" placeholder="SEARCH MARKET / SYMBOL"/><button>FAVORITES</button><button>PERPETUALS</button><button>24H</button></div>
            <div className="table-scroll">
              <table className="sym-table">
                <thead><tr><th>MARKET</th><th>PRICE</th><th>24H</th><th>SPREAD</th><th>VOLATILITY</th><th>BEST BID</th><th>BEST ASK</th><th>REGIME</th></tr></thead>
                <tbody>
                  {rows.map((row) => <tr key={row.market}>
                    <td>{row.symbol}</td><td>${row.markPrice.toLocaleString(undefined,{maximumFractionDigits:2})}</td>
                    <td className={row.change24hPct >= 0 ? "pos" : "neg"}>{row.change24hPct >= 0 ? "+" : ""}{row.change24hPct.toFixed(2)}%</td>
                    <td>{row.spreadBps.toFixed(2)} BPS</td><td>{row.volatilityPct.toFixed(2)}%</td>
                    <td className="pos">{row.bestBid.toLocaleString(undefined,{maximumFractionDigits:2})}</td><td className="neg">{row.bestAsk.toLocaleString(undefined,{maximumFractionDigits:2})}</td><td>{row.regime}</td>
                  </tr>)}
                  {!rows.length && <tr><td>ETH-PERP</td><td>SYNCING</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>ENGINE INITIALIZING</td></tr>}
                  <tr><td>ZEN-PERP</td><td>COMING SOON</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>INACTIVE</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
        <div className="system-footer"><span>MARKET DATA / TESTNET SIMULATION</span><span>GREEN + RED REPRESENT DATA ONLY</span></div>
      </div>
    </main>
  );
}
