import TerminalNav from "@/components/TerminalNav";

const weeks = [
  ["SEP 04 — SEP 11", "WEEK 01", "0", "UNRANKED"],
  ["SEP 11 — SEP 18", "WEEK 02", "—", "UPCOMING"],
  ["SEP 18 — SEP 25", "WEEK 03", "—", "UPCOMING"],
  ["SEP 25 — OCT 02", "WEEK 04", "—", "UPCOMING"]
];

export default function RewardsPage() {
  return (
    <main className="terminal-page">
      <TerminalNav />
      <div className="terminal-shell">
        <section className="season-hero">
          <div className="season-wave"/>
          <div className="terminal-kicker">06 / TESTNET INCENTIVES</div>
          <div className="season">SEASON</div><div className="season-number">01</div>
        </section>
        <section className="metric-ribbon">
          <div><span>TRADING VOLUME</span><strong>$0</strong></div><div><span>MM VOLUME</span><strong>$0</strong></div><div><span>LIQUIDITY PROVIDED</span><strong>$0</strong></div><div><span>TRADES</span><strong>0</strong></div><div><span>POINTS</span><strong>0</strong></div>
        </section>
        <section className="leader-grid">
          <div className="data-region">
            <div className="region-head"><span>DISTRIBUTION HISTORY</span><strong>SEASON 01</strong></div>
            <div className="table-scroll"><table className="sym-table"><thead><tr><th>EPOCH</th><th>NAME</th><th>POINTS</th><th>RANK</th></tr></thead><tbody>{weeks.map(([epoch,name,points,rank]) => <tr key={name}><td>{epoch}</td><td>{name}</td><td>{points}</td><td>{rank}</td></tr>)}</tbody></table></div>
          </div>
          <aside className="rank-card">
            <div className="region-head" style={{margin:"-18px -18px 18px"}}><span>YOUR WEEKLY TIER</span><strong>TESTNET</strong></div>
            <div className="rank-visual"><strong>GENESIS</strong></div>
            <div className="status-stack"><div><span>WEEKLY RANK</span><b>0</b></div><div><span>LAST WEEK POINTS</span><b>0</b></div><div><span>ALL TIME RANK</span><b>0</b></div><div><span>ALL TIME POINTS</span><b>0</b></div></div>
          </aside>
        </section>
        <section className="page-grid single"><div className="data-region"><div className="region-head"><span>LEADERBOARD</span><strong>NO QUALIFYING ACTIVITY YET</strong></div><div className="table-scroll"><table className="sym-table"><thead><tr><th>RANK</th><th>TRADER</th><th>VOLUME</th><th>PNL</th><th>MM VOLUME</th><th>POINTS</th></tr></thead><tbody><tr><td>—</td><td>AWAITING TESTNET ACTIVITY</td><td>$0</td><td>$0</td><td>$0</td><td>0</td></tr></tbody></table></div></div></section>
        <div className="system-footer"><span>POINTS MODEL / TESTNET EXPERIMENT</span><span>NO TOKEN OR FINANCIAL VALUE IMPLIED</span></div>
      </div>
    </main>
  );
}
