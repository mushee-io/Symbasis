"use client";

import { useEffect, useMemo, useState } from "react";
import type { MMSnapshot, MMTrade } from "@/lib/mm/engine";

function formatPrice(value: number) {
  const digits = value >= 10_000 ? 0 : value >= 1_000 ? 1 : 2;
  return value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function PremiumDepthBook() {
  const [snapshot, setSnapshot] = useState<MMSnapshot | null>(null);
  const [fills, setFills] = useState<MMTrade[]>([]);

  useEffect(() => {
    const onSnapshot = (event: Event) => {
      const next = (event as CustomEvent<MMSnapshot>).detail;
      if (!next) return;
      setSnapshot(next);
      setFills((previous) => {
        const byId = new Map<string, MMTrade>();
        [...next.trades, ...previous].forEach((trade) => byId.set(trade.id, trade));
        return [...byId.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
      });
    };
    window.addEventListener("symbasis:mm-snapshot", onSnapshot as EventListener);
    return () => window.removeEventListener("symbasis:mm-snapshot", onSnapshot as EventListener);
  }, []);

  const asks = useMemo(() => (snapshot?.asks ?? []).slice(0, 7).reverse(), [snapshot]);
  const bids = useMemo(() => (snapshot?.bids ?? []).slice(0, 7), [snapshot]);
  const maxDepth = useMemo(() => Math.max(1, ...asks.map((level) => level.cumulativeSize), ...bids.map((level) => level.cumulativeSize)), [asks, bids]);
  const mark = snapshot?.markPrice ?? 0;
  const spread = snapshot?.spreadBps ?? 0;

  return (
    <aside className="premium-depth-book" aria-label="Symbasis simulated testnet order flow">
      <div className="depth-tabs"><strong>ORDER BOOK</strong><span>LIVE FILLS</span><b>{spread ? `${spread.toFixed(1)} BPS` : "SYNC"}</b></div>
      <div className="depth-head"><span>PRICE</span><span>SIZE</span><span>TOTAL</span></div>

      <div className="depth-side asks">
        {asks.map((level, index) => (
          <div className="depth-row" key={`a-${level.price}-${index}`}>
            <i style={{ width: `${Math.min(100, (level.cumulativeSize / maxDepth) * 100)}%` }} />
            <span>{formatPrice(level.price)}</span><span>{level.size.toFixed(3)}</span><span>{level.cumulativeSize.toFixed(3)}</span>
          </div>
        ))}
      </div>

      <div className="depth-mark">
        <strong className={snapshot?.change24hPct && snapshot.change24hPct < 0 ? "flow-sell" : "flow-buy"}>{mark ? formatPrice(mark) : "—"}</strong>
        <span>{snapshot?.symbol ?? "PERP"}</span><small>SPREAD {spread ? `${spread.toFixed(2)} BPS` : "—"}</small>
      </div>

      <div className="depth-side bids">
        {bids.map((level, index) => (
          <div className="depth-row" key={`b-${level.price}-${index}`}>
            <i style={{ width: `${Math.min(100, (level.cumulativeSize / maxDepth) * 100)}%` }} />
            <span>{formatPrice(level.price)}</span><span>{level.size.toFixed(3)}</span><span>{level.cumulativeSize.toFixed(3)}</span>
          </div>
        ))}
      </div>

      <div className="tape-head"><span>TIME</span><span>PRICE</span><span>SIZE</span><span>SIDE</span></div>
      <div className="live-fill-tape">
        {fills.slice(0, 7).map((trade) => (
          <div className={`fill-row ${trade.side === "BUY" ? "is-buy" : "is-sell"}`} key={trade.id}>
            <span>{new Date(trade.timestamp).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            <strong>{formatPrice(trade.price)}</strong>
            <span>{trade.size.toFixed(3)}</span>
            <b>{trade.side}</b>
          </div>
        ))}
        {!fills.length && <div className="fill-empty">WAITING FOR SYMBASIS MM FLOW…</div>}
      </div>

      <div className="depth-foot"><span>SYMBASIS MM</span><span>SIMULATED TESTNET FLOW · NOT EXTERNAL VOLUME</span></div>
    </aside>
  );
}
