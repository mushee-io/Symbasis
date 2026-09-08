"use client";

import { useState } from "react";
import TerminalNav from "@/components/TerminalNav";

type RiskResult = { score:number; level:string; recommendedLeverage:number; suggestedMargin:number; suggestedPosition:number; liquidationDistance:string; warnings:string[] };

export default function RiskPage() {
  const [leverage,setLeverage]=useState(3);
  const [margin,setMargin]=useState(500);
  const [collateral,setCollateral]=useState(5000);
  const [volatility,setVolatility]=useState(3.5);
  const [result,setResult]=useState<RiskResult|null>(null);
  const [status,setStatus]=useState("READY");

  async function analyze() {
    try {
      setStatus("ANALYZING");
      const response=await fetch("/api/risk",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({collateral,margin,leverage,price:4300,side:"long",volatilityPct:volatility,fundingBpsPerDay:0})});
      const body=await response.json();
      if(!response.ok) throw new Error(body.error??"RISK ENGINE ERROR");
      setResult(body); setStatus("COMPLETE");
    } catch { setStatus("ERROR"); }
  }

  return (
    <main className="terminal-page">
      <TerminalNav />
      <div className="terminal-shell">
        <section className="terminal-header">
          <div><div className="terminal-kicker">08 / DECISION SUPPORT</div><h1>RISK<br/>ENGINE</h1></div>
          <p>Explainable pre-trade risk intelligence. The current baseline recommends parameters but cannot sign transactions or control wallet funds.</p>
        </section>
        <section className="metric-ribbon">
          <div><span>MODEL</span><strong>BASELINE V0.1</strong></div><div><span>MODE</span><strong>ADVISORY</strong></div><div><span>TRANSACTION CONTROL</span><strong>NONE</strong></div><div><span>STATUS</span><strong>{status}</strong></div><div><span>MARKET</span><strong>ETH-PERP</strong></div>
        </section>
        <section className="risk-grid">
          <section>
            <span className="tech-label">01 / SCENARIO INPUT</span><h2>PRE-TRADE PARAMETERS</h2>
            <div className="technical-form">
              <label>COLLATERAL / sUSDC<input type="number" min="1" value={collateral} onChange={e=>setCollateral(Number(e.target.value)||0)}/></label>
              <label>MARGIN / sUSDC<input type="number" min="1" value={margin} onChange={e=>setMargin(Number(e.target.value)||0)}/></label>
              <label>LEVERAGE / X<input type="number" min="1" max="10" value={leverage} onChange={e=>setLeverage(Math.max(1,Math.min(10,Number(e.target.value)||1)))}/></label>
              <label>VOLATILITY / %<input type="number" min="0" max="100" step="0.1" value={volatility} onChange={e=>setVolatility(Number(e.target.value)||0)}/></label>
              <button className="rect-button primary" type="button" onClick={analyze}>[ RUN ANALYSIS ]</button>
            </div>
          </section>
          <section>
            <span className="tech-label">02 / OUTPUT</span><h2>{result ? `${result.score}/100 · ${result.level}` : "AWAITING ANALYSIS"}</h2>
            {result ? <>
              <div className="status-stack"><div><span>RECOMMENDED LEVERAGE</span><b>{result.recommendedLeverage}×</b></div><div><span>SUGGESTED MARGIN</span><b>${result.suggestedMargin}</b></div><div><span>SUGGESTED POSITION</span><b>${result.suggestedPosition}</b></div><div><span>LIQUIDATION BUFFER</span><b>{result.liquidationDistance}</b></div></div>
              <p>{result.warnings.join(" / ")}</p>
            </> : <p>Run a scenario to calculate leverage pressure, collateral concentration and approximate liquidation distance.</p>}
          </section>
          <section><span className="tech-label">03 / SIGNALS</span><h2>WHAT IT MEASURES</h2><p>Leverage, margin concentration, volatility and funding inputs are combined into an explainable score. The result is intentionally transparent rather than a black-box model.</p></section>
          <section><span className="tech-label">04 / EXECUTION BOUNDARY</span><h2>ADVISORY ONLY</h2><p>Risk analysis can inform the order ticket, but execution remains explicitly controlled by the trader and wallet. No server-side private key exists.</p></section>
        </section>
        <div className="system-footer"><span>RISK OUTPUT IS DECISION SUPPORT — NOT FINANCIAL ADVICE</span><span>NO AUTONOMOUS WALLET CONTROL</span></div>
      </div>
    </main>
  );
}
