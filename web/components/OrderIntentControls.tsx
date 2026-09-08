"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import type { MMSnapshot } from "@/lib/mm/engine";

type IntentMode = "MARKET" | "LIMIT" | "TRIGGER";
type Side = "LONG" | "SHORT";

type LocalIntent = {
  mode: Exclude<IntentMode, "MARKET">;
  market: string;
  side: Side;
  price: number;
  margin: string;
  leverage: string;
  armedAt: number;
};

const STORAGE_KEY = "symbasis:testnet-order-intent:v1";

function numberFrom(text: string | null | undefined) {
  const parsed = Number(String(text ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function OrderIntentControls() {
  const [target, setTarget] = useState<Element | null>(null);
  const [mode, setMode] = useState<IntentMode>("MARKET");
  const [side, setSide] = useState<Side>("LONG");
  const [market, setMarket] = useState("ETH-PERP");
  const [simMark, setSimMark] = useState(0);
  const [price, setPrice] = useState("");
  const [intent, setIntent] = useState<LocalIntent | null>(null);

  useEffect(() => {
    const locate = () => {
      const panel = document.querySelector(".sym-trade-route .order-panel");
      if (panel) setTarget(panel);
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setIntent(JSON.parse(stored) as LocalIntent);
    } catch {}
  }, []);

  useEffect(() => {
    const readTerminal = () => {
      const active = document.querySelector(".sym-trade-route .side-toggle .active-side")?.textContent?.toUpperCase();
      setSide(active === "SHORT" ? "SHORT" : "LONG");
      const symbol = document.querySelector(".sym-trade-route .market-title > span")?.textContent?.trim();
      if (symbol) setMarket(symbol);
    };
    readTerminal();
    const observer = new MutationObserver(readTerminal);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onSnapshot = (event: Event) => {
      const next = (event as CustomEvent<MMSnapshot>).detail;
      if (!next) return;
      setSimMark(next.markPrice);
      if (!price) setPrice(String(next.markPrice));
    };
    window.addEventListener("symbasis:mm-snapshot", onSnapshot as EventListener);
    return () => window.removeEventListener("symbasis:mm-snapshot", onSnapshot as EventListener);
  }, [price]);

  useEffect(() => {
    if (!target) return;
    target.classList.toggle("intent-alt-mode", mode !== "MARKET");
    return () => target.classList.remove("intent-alt-mode");
  }, [target, mode]);

  function setPercent(percent: number) {
    const label = [...document.querySelectorAll(".sym-trade-route .order-panel label")]
      .find((node) => node.textContent?.includes("AVAILABLE"));
    const available = numberFrom(label?.textContent?.split("AVAILABLE")[1]);
    const input = document.querySelector(".sym-trade-route .order-panel input[aria-label='Trade margin']") as HTMLInputElement | null;
    if (!input || !available) return;
    setNativeInputValue(input, Math.max(0, available * percent / 100).toFixed(2));
  }

  function armIntent() {
    const numericPrice = Number(price);
    const marginInput = document.querySelector(".sym-trade-route .order-panel input[aria-label='Trade margin']") as HTMLInputElement | null;
    const leverageInput = document.querySelector(".sym-trade-route .order-panel input[type='range']") as HTMLInputElement | null;
    if (mode === "MARKET" || !Number.isFinite(numericPrice) || numericPrice <= 0 || !marginInput) return;
    const next: LocalIntent = {
      mode,
      market,
      side,
      price: numericPrice,
      margin: marginInput.value,
      leverage: leverageInput?.value ?? "1",
      armedAt: Date.now()
    };
    setIntent(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function cancelIntent() {
    setIntent(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  const triggered = !!intent && intent.market === market && simMark > 0 && (
    intent.mode === "LIMIT"
      ? (intent.side === "LONG" ? simMark <= intent.price : simMark >= intent.price)
      : (intent.side === "LONG" ? simMark >= intent.price : simMark <= intent.price)
  );

  function executeIntent() {
    if (!intent || !triggered) return;
    const marginInput = document.querySelector(".sym-trade-route .order-panel input[aria-label='Trade margin']") as HTMLInputElement | null;
    const leverageInput = document.querySelector(".sym-trade-route .order-panel input[type='range']") as HTMLInputElement | null;
    if (marginInput) setNativeInputValue(marginInput, intent.margin);
    if (leverageInput) setNativeInputValue(leverageInput, intent.leverage);
    const desiredSide = intent.side.toLowerCase();
    const sideButton = document.querySelector(`.sym-trade-route .side-toggle .${desiredSide}`) as HTMLButtonElement | null;
    sideButton?.click();
    window.setTimeout(() => {
      const execute = document.querySelector(`.sym-trade-route .order-panel .primary.${desiredSide}-btn`) as HTMLButtonElement | null;
      if (execute && !execute.disabled) {
        execute.click();
        cancelIntent();
      }
    }, 50);
  }

  if (!target) return null;

  return createPortal(
    <section className="order-intent-controls">
      <div className="order-mode-tabs">
        {(["MARKET", "LIMIT", "TRIGGER"] as IntentMode[]).map((item) => <button key={item} onClick={() => setMode(item)} className={mode === item ? "is-active" : ""}>{item}</button>)}
      </div>
      <div className="quick-size-row"><span>QUICK SIZE</span>{[25,50,75,100].map((value) => <button key={value} onClick={() => setPercent(value)}>{value}%</button>)}</div>

      {mode !== "MARKET" && <div className="intent-builder">
        <label>{mode === "LIMIT" ? "LIMIT PRICE" : "TRIGGER PRICE"}<span>SIM MARK {simMark ? simMark.toLocaleString(undefined,{maximumFractionDigits:2}) : "—"}</span></label>
        <div className="intent-price-row"><input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal"/><button onClick={() => simMark && setPrice(String(simMark))}>MARK</button></div>
        <button className="arm-intent" onClick={armIntent}>ARM {mode} INTENT</button>
        <p>CLIENT-SIDE TESTNET INTENT · EXECUTION STILL REQUIRES AN EXPLICIT WALLET SIGNATURE.</p>
      </div>}

      {intent && <div className={`armed-intent ${triggered ? "is-triggered" : ""}`}>
        <div><span>ARMED</span><strong>{intent.side} {intent.mode}</strong></div>
        <div><span>MARKET</span><strong>{intent.market}</strong></div>
        <div><span>PRICE</span><strong>{intent.price.toLocaleString()}</strong></div>
        <div><span>STATUS</span><strong>{triggered ? "TRIGGERED" : "WATCHING"}</strong></div>
        <div className="intent-actions"><button onClick={cancelIntent}>CANCEL</button><button className="execute-trigger" onClick={executeIntent} disabled={!triggered}>EXECUTE IN WALLET</button></div>
      </div>}
    </section>,
    target
  );
}
