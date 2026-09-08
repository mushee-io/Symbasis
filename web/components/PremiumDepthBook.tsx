"use client";

import { useEffect, useMemo, useState } from "react";

type Level = { price: number; size: number; total: number; depth: number };

function parsePrice(value: string | null | undefined) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildSide(mark: number, side: "ask" | "bid"): Level[] {
  if (!mark) return [];
  const sign = side === "ask" ? 1 : -1;
  let running = 0;
  return Array.from({ length: 10 }, (_, index) => {
    const distance = (index + 1) * 0.00032;
    const price = mark * (1 + sign * distance);
    const size = 0.38 + ((index * 17 + 7) % 23) / 5.2;
    running += size;
    return { price, size, total: running, depth: 24 + ((index * 31 + 19) % 72) };
  });
}

export default function PremiumDepthBook() {
  const [mark, setMark] = useState(0);
  const [symbol, setSymbol] = useState("PERP");

  useEffect(() => {
    const readTerminal = () => {
      const markNode = document.querySelector(".sym-trade-route .price-box strong");
      const symbolNode = document.querySelector(".sym-trade-route .market-title > span");
      const next = parsePrice(markNode?.textContent);
      if (next > 0) setMark(next);
      if (symbolNode?.textContent) setSymbol(symbolNode.textContent.trim());
    };

    readTerminal();
    const observer = new MutationObserver(readTerminal);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  const asks = useMemo(() => buildSide(mark, "ask").reverse(), [mark]);
  const bids = useMemo(() => buildSide(mark, "bid"), [mark]);
  const decimals = mark >= 10_000 ? 0 : mark >= 1_000 ? 1 : 2;

  return (
    <aside className="premium-depth-book" aria-label="Symbasis simulated testnet depth">
      <div className="depth-tabs"><strong>ORDER BOOK</strong><span>TRADES</span><b>0.1 ▾</b></div>
      <div className="depth-head"><span>PRICE</span><span>SIZE</span><span>TOTAL</span></div>
      <div className="depth-side asks">
        {asks.map((level, index) => (
          <div className="depth-row" key={`a-${index}`}>
            <i style={{ width: `${level.depth}%` }} />
            <span>{level.price.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>
            <span>{level.size.toFixed(3)}</span><span>{level.total.toFixed(3)}</span>
          </div>
        ))}
      </div>
      <div className="depth-mark">
        <strong>{mark ? mark.toLocaleString(undefined, { maximumFractionDigits: decimals }) : "—"}</strong>
        <span>{symbol}</span><small>SPREAD 0.06%</small>
      </div>
      <div className="depth-side bids">
        {bids.map((level, index) => (
          <div className="depth-row" key={`b-${index}`}>
            <i style={{ width: `${level.depth}%` }} />
            <span>{level.price.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>
            <span>{level.size.toFixed(3)}</span><span>{level.total.toFixed(3)}</span>
          </div>
        ))}
      </div>
      <div className="depth-foot"><span>SYMBASIS MM</span><span>SIMULATED TESTNET DEPTH</span></div>
    </aside>
  );
}
