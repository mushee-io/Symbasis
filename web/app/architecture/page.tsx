import TerminalNav from "@/components/TerminalNav";
import { DEPLOYED_HORIZEN_TESTNET, HORIZEN_TESTNET, MARKETS } from "@/lib/config";

const contracts = [
  ["sUSDC", DEPLOYED_HORIZEN_TESTNET.mockUSDC, "Testnet collateral token"],
  ["VAULT", DEPLOYED_HORIZEN_TESTNET.vault, "Collateral, reserved margin and PnL settlement"],
  ["MARKET REGISTRY", DEPLOYED_HORIZEN_TESTNET.marketRegistry, "ETH/BTC perpetual market configuration"],
  ["DEMO ORACLE", DEPLOYED_HORIZEN_TESTNET.demoOracle, "Controlled testnet price publisher; Stork-ready path retained"],
  ["PERP ENGINE", DEPLOYED_HORIZEN_TESTNET.perpEngine, "Long/short, leverage, PnL, funding and liquidation"],
  ["INTENT REGISTRY", DEPLOYED_HORIZEN_TESTNET.intents, "Stores strategy commitments, not raw mandate text"]
] as const;

export default function ArchitecturePage() {
  return (
    <main className="terminal-page">
      <TerminalNav />
      <div className="terminal-shell">
        <section className="terminal-header">
          <div><div className="terminal-kicker">10 / GRANT REVIEWER ARCHITECTURE</div><h1>ARCHITECTURE</h1></div>
          <p>Public technical proof for the deployed Symbasis testnet system: execution, market simulation, oracle boundary, risk layer and privacy boundary.</p>
        </section>

        <section className="metric-ribbon">
          <div><span>NETWORK</span><strong>HORIZEN</strong></div>
          <div><span>CHAIN ID</span><strong>{HORIZEN_TESTNET.chainId}</strong></div>
          <div><span>SMOKE TEST</span><strong className="pos">PASS</strong></div>
          <div><span>MARKETS</span><strong>ETH / BTC</strong></div>
          <div><span>STATUS</span><strong>TESTNET</strong></div>
        </section>

        <section className="page-grid single">
          <div className="data-region">
            <div className="region-head"><span>EXECUTION PATH</span><strong>PUBLIC TESTNET BOUNDARY</strong></div>
            <div style={{padding:24,color:"#c9c9c6",font:"700 11px/1.8 var(--sym-mono)",letterSpacing:".02em"}}>
              WALLET → TERMINAL → AI RISK ADVISORY → PERP ENGINE → VAULT<br/>
              SYMBASIS MM → CANDLES / ORDER BOOK / FILL TAPE → DEMO ORACLE → PERP ENGINE<br/>
              PRIVATE MANDATE → LOCAL HASH → CONFIDENTIAL INTENT REGISTRY<br/>
              STORK SIGNED DATA → STORK ADAPTER → PERP ENGINE &nbsp;[WHEN SIGNED API ACCESS IS ENABLED]
            </div>
          </div>
        </section>

        <section className="page-grid single">
          <div className="data-region">
            <div className="region-head"><span>DEPLOYED CONTRACTS</span><strong>HORIZEN TESTNET</strong></div>
            <div className="table-scroll"><table className="sym-table">
              <thead><tr><th>COMPONENT</th><th>ADDRESS</th><th>ROLE</th><th>VERIFY</th></tr></thead>
              <tbody>{contracts.map(([name,address,role]) => <tr key={name}>
                <td>{name}</td><td style={{fontFamily:"var(--sym-mono)"}}>{address}</td><td>{role}</td>
                <td><a href={`${HORIZEN_TESTNET.explorer}/address/${address}`} target="_blank" rel="noreferrer">EXPLORER ↗</a></td>
              </tr>)}</tbody>
            </table></div>
          </div>
        </section>

        <section className="page-grid single">
          <div className="data-region">
            <div className="region-head"><span>MARKET / PRIVACY DISCLOSURE</span><strong>WHAT IS LIVE TODAY</strong></div>
            <div className="table-scroll"><table className="sym-table">
              <thead><tr><th>SYSTEM</th><th>STATUS</th><th>BOUNDARY</th></tr></thead>
              <tbody>
                <tr><td>ETH-PERP</td><td className="pos">DEPLOYED</td><td>Feed {MARKETS.ETH.feedId.slice(0,18)}…</td></tr>
                <tr><td>BTC-PERP</td><td className="pos">DEPLOYED</td><td>Feed {MARKETS.BTC.feedId.slice(0,18)}…</td></tr>
                <tr><td>SYMBASIS MM</td><td>SIMULATED TESTNET</td><td>Creates synthetic depth, fills and candles; not real external volume</td></tr>
                <tr><td>PRIVATE MANDATE</td><td className="pos">COMMITMENT LIVE</td><td>Raw browser text is not submitted onchain; commitment is public</td></tr>
                <tr><td>PUBLIC POSITIONS</td><td className="neg">NOT CONFIDENTIAL</td><td>Current Horizen testnet position state remains public</td></tr>
                <tr><td>VELA</td><td>LOCAL DEV READY</td><td>Shared Horizen testnet deployment is not currently available</td></tr>
              </tbody>
            </table></div>
          </div>
        </section>

        <div className="system-footer"><span><a href="/api/grant-readiness">LIVE READINESS JSON ↗</a></span><span><a href="https://github.com/mushee-io/Symbasis" target="_blank" rel="noreferrer">SOURCE / CI ↗</a></span></div>
      </div>
    </main>
  );
}
