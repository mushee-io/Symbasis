import TerminalNav from "@/components/TerminalNav";

export default function PortfolioPage() {
  return (
    <main className="terminal-page">
      <TerminalNav />
      <div className="terminal-shell">
        <section className="terminal-header">
          <div><div className="terminal-kicker">03 / ACCOUNT MANAGEMENT</div><h1>PORTFOLIO</h1></div>
          <p>Institutional account telemetry for collateral, margin, realized and unrealized performance, funding and execution history.</p>
        </section>
        <section className="account-hero">
          <div className="account-title"><span>ACCOUNT 01 / HORIZEN TESTNET</span><strong>$0.00</strong></div>
          <div><span>30D VOLUME</span><b>$0.00</b></div>
          <div><span>AVAILABLE MARGIN</span><b>$0.00</b></div>
          <div><span>24H PNL</span><b className="pos">+$0.00</b></div>
        </section>
        <section className="page-grid">
          <div className="data-region">
            <div className="region-head"><span>ACCOUNT EQUITY / 24H</span><strong>NO ACTIVITY</strong></div>
            <div className="equity-chart">
              <svg viewBox="0 0 900 280" preserveAspectRatio="none" aria-label="Account equity placeholder">
                <polyline points="0,202 90,202 180,202 270,202 360,202 450,202 540,202 630,202 720,202 810,202 900,202"/>
              </svg>
            </div>
          </div>
          <aside className="data-region">
            <div className="region-head"><span>MARGIN SYSTEM</span><strong>ACCOUNT 01</strong></div>
            <div className="status-stack" style={{margin:0,padding:"0 18px"}}>
              <div><span>BALANCE</span><b>$0.00</b></div><div><span>UNREALIZED PERP PNL</span><b>$0.00</b></div><div><span>REALIZED PNL</span><b>$0.00</b></div><div><span>MARGIN USAGE</span><b className="pos">0.00%</b></div><div><span>MAINTENANCE MARGIN</span><b>$0.00</b></div><div><span>ACCOUNT LEVERAGE</span><b>0.00×</b></div><div><span>FUNDING PAID</span><b>$0.00</b></div><div><span>FEES PAID</span><b>$0.00</b></div>
            </div>
          </aside>
        </section>
        <section className="page-grid single">
          <div className="data-region">
            <div className="region-head"><span>POSITIONS / OPEN ORDERS / HISTORY</span><strong>POSITIONS</strong></div>
            <div className="table-scroll"><table className="sym-table"><thead><tr><th>MARKET</th><th>SIDE</th><th>SIZE</th><th>VALUE</th><th>ENTRY</th><th>MARK</th><th>LIQUIDATION</th><th>PNL</th></tr></thead><tbody><tr><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>NO OPEN POSITIONS</td></tr></tbody></table></div>
          </div>
        </section>
        <div className="system-footer"><span>ACCOUNT STATE IS READ FROM HORIZEN AFTER WALLET CONNECTION</span><span>TESTNET ONLY</span></div>
      </div>
    </main>
  );
}
