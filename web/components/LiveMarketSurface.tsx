"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import type { MMSnapshot } from "@/lib/mm/engine";

type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
};

type MMResponse = { ok: boolean; snapshot?: MMSnapshot };

type Timeframe = "1M" | "5M" | "15M" | "30M" | "1H" | "4H" | "1D";

const TIMEFRAMES: Timeframe[] = ["1M", "5M", "15M", "30M", "1H", "4H", "1D"];
const CANDLE_COUNT = 54;

function parsePrice(value: string | null | undefined) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function selectedMarket() {
  const symbol = document.querySelector(".sym-trade-route .market-title > span")?.textContent ?? "ETH-PERP";
  return symbol.toUpperCase().startsWith("BTC") ? "BTC" : "ETH";
}

function timeframeScale(timeframe: Timeframe) {
  switch (timeframe) {
    case "5M": return 1.18;
    case "15M": return 1.42;
    case "30M": return 1.66;
    case "1H": return 1.9;
    case "4H": return 2.35;
    case "1D": return 2.8;
    default: return 1;
  }
}

function seededCandles(anchor: number, market: "ETH" | "BTC", timeframe: Timeframe): Candle[] {
  if (!anchor) return [];
  const scale = timeframeScale(timeframe);
  const baseVol = market === "BTC" ? 0.00145 : 0.0019;
  const now = Date.now();
  let close = anchor * (1 - 0.0045 * scale);
  const result: Candle[] = [];

  for (let index = 0; index < CANDLE_COUNT; index += 1) {
    const wave = Math.sin(index * 0.47 + (market === "BTC" ? 0.9 : 0.2)) * baseVol * scale;
    const micro = Math.sin(index * 1.73 + 2.1) * baseVol * 0.44 * scale;
    const drift = index > CANDLE_COUNT * 0.58 ? baseVol * 0.08 : -baseVol * 0.015;
    const open = close;
    close = Math.max(1, open * (1 + wave * 0.34 + micro * 0.24 + drift));
    const wick = open * baseVol * (0.38 + (index % 5) * 0.09) * scale;
    const high = Math.max(open, close) + wick;
    const low = Math.max(1, Math.min(open, close) - wick * 0.82);
    const volume = 20 + ((index * 37 + (market === "BTC" ? 11 : 23)) % 95);
    result.push({ open, high, low, close, volume, timestamp: now - (CANDLE_COUNT - index) * 60_000 });
  }

  const correction = anchor / result[result.length - 1].close;
  return result.map((candle) => ({
    ...candle,
    open: candle.open * correction,
    high: candle.high * correction,
    low: candle.low * correction,
    close: candle.close * correction
  }));
}

function formatPrice(value: number) {
  const digits = value >= 10_000 ? 0 : value >= 1_000 ? 1 : 2;
  return value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function LiveMarketSurface() {
  const [target, setTarget] = useState<Element | null>(null);
  const [snapshot, setSnapshot] = useState<MMSnapshot | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>("1M");
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [market, setMarket] = useState<"ETH" | "BTC">("ETH");
  const [oracleAnchor, setOracleAnchor] = useState(0);

  useEffect(() => {
    const locate = () => {
      const panel = document.querySelector(".sym-trade-route .market-panel");
      if (panel) setTarget(panel);
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const readTerminal = () => {
      const nextMarket = selectedMarket();
      const anchor = parsePrice(document.querySelector(".sym-trade-route .price-box strong")?.textContent);
      setMarket(nextMarket);
      if (anchor > 0) setOracleAnchor(anchor);
    };
    readTerminal();
    const observer = new MutationObserver(readTerminal);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const anchor = oracleAnchor > 0 ? `&anchor=${encodeURIComponent(String(oracleAnchor))}` : "";
        const response = await fetch(`/api/mm?market=${market}&levels=14&trades=18${anchor}`, { cache: "no-store" });
        const body = await response.json() as MMResponse;
        if (!live || !body.ok || !body.snapshot) return;
        const next = body.snapshot;
        setSnapshot(next);
        window.dispatchEvent(new CustomEvent("symbasis:mm-snapshot", { detail: next }));
        setCandles((previous) => {
          const seeded = previous.length ? previous : seededCandles(next.markPrice, market, timeframe);
          if (!seeded.length) return seeded;
          const updated = [...seeded];
          const lastIndex = updated.length - 1;
          const last = { ...updated[lastIndex] };
          const tradeVolume = next.trades.reduce((sum, trade) => sum + trade.size, 0);
          last.close = next.markPrice;
          last.high = Math.max(last.high, next.markPrice);
          last.low = Math.min(last.low, next.markPrice);
          last.volume = Math.max(last.volume * 0.82, tradeVolume * 8.5);
          updated[lastIndex] = last;

          if ((next.sequence % 5) === 0) {
            const nextCandle: Candle = {
              open: last.close,
              high: last.close,
              low: last.close,
              close: next.markPrice,
              volume: Math.max(8, tradeVolume * 5),
              timestamp: Date.now()
            };
            return [...updated.slice(-(CANDLE_COUNT - 1)), nextCandle];
          }
          return updated.slice(-CANDLE_COUNT);
        });
      } catch {
        // Keep the previous market frame if the simulation endpoint is temporarily unavailable.
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 1_250);
    return () => { live = false; window.clearInterval(timer); };
  }, [market, oracleAnchor, timeframe]);

  useEffect(() => {
    const anchor = snapshot?.market === market ? snapshot.markPrice : oracleAnchor;
    if (anchor > 0) setCandles(seededCandles(anchor, market, timeframe));
  }, [timeframe, market]);

  const geometry = useMemo(() => {
    const width = 1000;
    const height = 430;
    const priceTop = 24;
    const priceBottom = 334;
    const volumeTop = 354;
    const volumeBottom = 410;
    if (!candles.length) return { width, height, priceTop, priceBottom, volumeTop, volumeBottom, min: 0, max: 1, maxVol: 1 };
    const lows = candles.map((c) => c.low);
    const highs = candles.map((c) => c.high);
    const rawMin = Math.min(...lows);
    const rawMax = Math.max(...highs);
    const padding = Math.max((rawMax - rawMin) * 0.12, rawMax * 0.0007);
    return {
      width,
      height,
      priceTop,
      priceBottom,
      volumeTop,
      volumeBottom,
      min: Math.max(0, rawMin - padding),
      max: rawMax + padding,
      maxVol: Math.max(1, ...candles.map((c) => c.volume))
    };
  }, [candles]);

  if (!target) return null;

  const { width, height, priceTop, priceBottom, volumeTop, volumeBottom, min, max, maxVol } = geometry;
  const plotLeft = 14;
  const plotRight = 920;
  const plotWidth = plotRight - plotLeft;
  const candleStep = candles.length ? plotWidth / candles.length : plotWidth;
  const candleWidth = Math.max(3, Math.min(10, candleStep * 0.58));
  const yForPrice = (price: number) => priceBottom - ((price - min) / Math.max(max - min, 1)) * (priceBottom - priceTop);
  const currentPrice = snapshot?.markPrice ?? candles[candles.length - 1]?.close ?? oracleAnchor;
  const currentY = yForPrice(currentPrice || min);
  const priceTicks = Array.from({ length: 6 }, (_, i) => max - ((max - min) * i) / 5);
  const change = snapshot?.change24hPct ?? 0;
  const tradeVolume = snapshot?.trades.reduce((sum, trade) => sum + trade.size * trade.price, 0) ?? 0;

  return createPortal(
    <section className="live-market-surface" aria-label="Symbasis simulated candlestick market stream">
      <div className="live-chart-toolbar">
        <div className="live-chart-tabs">
          {TIMEFRAMES.map((item) => <button key={item} className={timeframe === item ? "is-active" : ""} onClick={() => setTimeframe(item)}>{item}</button>)}
        </div>
        <div className="live-chart-metrics">
          <span>24H <b className={change >= 0 ? "flow-buy" : "flow-sell"}>{change >= 0 ? "+" : ""}{change.toFixed(2)}%</b></span>
          <span>FLOW <b>${tradeVolume.toLocaleString(undefined,{maximumFractionDigits:0})}</b></span>
          <span>VOL <b>{snapshot?.volatilityPct.toFixed(2) ?? "—"}%</b></span>
          <span>REGIME <b>{snapshot?.regime ?? "SYNC"}</b></span>
          <span className="sim-label">SIMULATED TESTNET STREAM</span>
        </div>
      </div>

      <div className="live-chart-wrap" onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * width;
        const y = ((event.clientY - rect.top) / rect.height) * height;
        setHover({ x, y });
      }} onMouseLeave={() => setHover(null)}>
        <svg className="live-candle-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${market} perpetual simulated candlestick chart`}>
          {Array.from({ length: 7 }, (_, index) => {
            const y = priceTop + ((priceBottom - priceTop) * index) / 6;
            return <line key={`h-${index}`} x1={plotLeft} y1={y} x2={plotRight} y2={y} className="chart-grid-line" />;
          })}
          {Array.from({ length: 9 }, (_, index) => {
            const x = plotLeft + (plotWidth * index) / 8;
            return <line key={`v-${index}`} x1={x} y1={priceTop} x2={x} y2={volumeBottom} className="chart-grid-line" />;
          })}

          {candles.map((candle, index) => {
            const x = plotLeft + index * candleStep + candleStep / 2;
            const openY = yForPrice(candle.open);
            const closeY = yForPrice(candle.close);
            const highY = yForPrice(candle.high);
            const lowY = yForPrice(candle.low);
            const up = candle.close >= candle.open;
            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(1.4, Math.abs(closeY - openY));
            const volumeHeight = (candle.volume / maxVol) * (volumeBottom - volumeTop);
            return <g key={`${candle.timestamp}-${index}`} className={up ? "candle-up" : "candle-down"}>
              <line x1={x} x2={x} y1={highY} y2={lowY} className="candle-wick" />
              <rect x={x - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} className="candle-body" />
              <rect x={x - candleWidth / 2} y={volumeBottom - volumeHeight} width={candleWidth} height={volumeHeight} className="volume-body" />
            </g>;
          })}

          <line x1={plotLeft} y1={currentY} x2={plotRight} y2={currentY} className="current-price-line" />
          <rect x={plotRight + 3} y={currentY - 10} width="74" height="20" className="price-tag-bg" />
          <text x={plotRight + 40} y={currentY + 3} textAnchor="middle" className="price-tag-text">{currentPrice ? formatPrice(currentPrice) : "—"}</text>

          {priceTicks.map((value, index) => <text key={`p-${index}`} x={plotRight + 8} y={yForPrice(value) + 4} className="axis-label">{formatPrice(value)}</text>)}

          {hover && hover.x >= plotLeft && hover.x <= plotRight && hover.y >= priceTop && hover.y <= volumeBottom && <>
            <line x1={hover.x} y1={priceTop} x2={hover.x} y2={volumeBottom} className="crosshair" />
            <line x1={plotLeft} y1={hover.y} x2={plotRight} y2={hover.y} className="crosshair" />
          </>}
        </svg>

        <div className="live-chart-badge">
          <strong>{market}-PERP</strong>
          <span>SIM MARK</span>
          <b className={change >= 0 ? "flow-buy" : "flow-sell"}>{currentPrice ? `$${formatPrice(currentPrice)}` : "SYNCING"}</b>
        </div>
      </div>

      <div className="live-chart-footer">
        <span>SYMBASIS MM · 1.25S QUOTE CYCLE · TESTNET SIMULATION</span>
        <span>ORACLE ANCHOR {oracleAnchor ? `$${formatPrice(oracleAnchor)}` : "AWAITING WALLET / ORACLE"}</span>
      </div>
    </section>,
    target
  );
}
