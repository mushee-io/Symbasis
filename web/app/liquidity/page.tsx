import TerminalNav from "@/components/TerminalNav";

export default function LiquidityPage() {
  return (
    <main className="terminal-page">
      <TerminalNav />
      <div className="terminal-shell">
        <section className="terminal-header">
          <div><div className="terminal-kicker">04 / COLLATERAL + LIQUIDITY</div><h1>LIQUIDITY</h1></div>
          <p>Protocol liquidity and collateral infrastructure. Testnet balances are isolated from the market-making simulator and are used only for Symbasis contract settlement.</p>
        </section>
        <section className="metric-ribbon">
          <div><span>VAULT STATUS</span><strong>LOCKED</strong></div>
          <div><span>COLLATERAL</span><strong>sUSDC</strong></div>
          <div><span>SEED LIQUIDITY</span><strong>$500K</strong></div>
          <div><span>MARKETS</span><strong>02</strong></div>
          <div><span>SETTLEMENT</span><strong>ISOLATED</strong></div>
        </section>
        <section className="vault-grid">
          <article className="vault-card"><span className="tech-label">01 / PROTOCOL VAULT</span><div className="huge">$500,000</div><p>Test sUSDC seeded during deployment to settle profitable positions and support the testnet execution environment.</p></article>
          <article className="vault-card"><span className="tech-label">02 / RESERVED MARGIN</span><div className="huge">$0.00</div><p>Margin reserved against open trader positions. Withdrawals cannot consume collateral currently securing active positions.</p></article>
          <article className="vault-card"><span className="tech-label">03 / BAD DEBT</span><div className="huge">$0.00</div><p>Loss accounting is explicit. Isolated position losses are capped by posted margin in the current testnet engine.</p></article>
        </section>
        <section className="page-grid">
          <div className="data-region">
            <div className="region-head"><span>LIQUIDITY UTILIZATION</span><strong>TESTNET</strong></div>
            <div className="equity-chart"><svg viewBox="0 0 900 280" preserveAspectRatio="none"><polyline points="0,220 120,218 240,215 360,214 480,210 600,210 720,206 900,204"/></svg></div>
          </div>
          <aside className="data-region">
            <div className="region-head"><span>VAULT CONTROLS</span><strong>ENGINE LOCKED</strong></div>
            <div className="status-stack" style={{margin:0,padding:"0 18px"}}>
              <div><span>ENGINE</span><b>PERP ENGINE</b></div><div><span>ENGINE MUTABILITY</span><b>LOCKED</b></div><div><span>WITHDRAW FREE COLLATERAL</span><b>ENABLED</b></div><div><span>WITHDRAW RESERVED COLLATERAL</span><b>BLOCKED</b></div><div><span>PROTOCOL LIQUIDITY DRAIN</span><b>BLOCKED AFTER LOCK</b></div><div><span>EMERGENCY EXIT</span><b>AVAILABLE</b></div>
            </div>
          </aside>
        </section>
        <div className="system-footer"><span>LIQUIDITY PAGE DESCRIBES CURRENT TESTNET VAULT ARCHITECTURE</span><span>NOT A YIELD PRODUCT</span></div>
      </div>
    </main>
  );
}
