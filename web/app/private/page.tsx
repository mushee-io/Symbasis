import Link from "next/link";
import TerminalNav from "@/components/TerminalNav";

export default function PrivatePage() {
  return (
    <main className="terminal-page">
      <TerminalNav />
      <div className="terminal-shell">
        <section className="terminal-header">
          <div><div className="terminal-kicker">07 / CONFIDENTIAL INTENT</div><h1>PRIVATE<br/>MANDATES</h1></div>
          <p>Strategy text stays offchain. Symbasis currently anchors only the keccak256 commitment and attested result hashes while shared VELA deployment is unavailable.</p>
        </section>
        <section className="metric-ribbon">
          <div><span>RAW STRATEGY</span><strong>OFFCHAIN</strong></div><div><span>COMMITMENT</span><strong>ONCHAIN</strong></div><div><span>HASH</span><strong>KECCAK256</strong></div><div><span>VELA</span><strong>LOCAL</strong></div><div><span>TESTNET PRIVACY</span><strong>PARTIAL</strong></div>
        </section>
        <section className="private-grid">
          <section><span className="tech-label">01 / PRIVATE INPUT</span><h2>MANDATE</h2><p>Examples include maximum leverage, market allowlists, exposure limits, stop conditions and execution constraints. The plaintext instruction should never be submitted directly to the public chain.</p><div className="technical-form"><textarea readOnly rows={6} value={"MAX LEVERAGE: 3X\nMARKETS: ETH-PERP, BTC-PERP\nMAX COLLATERAL RISK: 2%\nVOLATILITY MODE: REDUCE EXPOSURE\nEXECUTION: PRIVATE"}/></div></section>
          <section><span className="tech-label">02 / PUBLIC COMMITMENT</span><h2>HASH ONLY</h2><p>The browser computes a deterministic commitment. The public registry proves an intent existed without publishing the strategy itself.</p><div className="status-stack"><div><span>REGISTRY</span><b>CONFIDENTIAL INTENT REGISTRY</b></div><div><span>RAW MANDATE STORED</span><b>NO</b></div><div><span>COMMITMENT STORED</span><b>YES</b></div><div><span>ATTESTATION ROLE</span><b>TWO-STEP CONTROL</b></div></div></section>
          <section><span className="tech-label">03 / CONFIDENTIAL EXECUTION</span><h2>VELA PATH</h2><p>Horizen VELA is integrated as a local confidential-execution development path. Symbasis does not claim live shared-testnet TEE privacy until Horizen exposes that infrastructure.</p><div className="status-stack"><div><span>LOCAL GUEST</span><b>READY</b></div><div><span>SHARED TESTNET</span><b>UNAVAILABLE</b></div><div><span>PRODUCTION CLAIM</span><b>DISABLED</b></div></div></section>
          <section><span className="tech-label">04 / ACTION</span><h2>COMMIT A STRATEGY</h2><p>The currently functional commitment transaction remains in the trading terminal so it can use the same connected wallet and deployed registry.</p><Link className="rect-button primary" href="/trade" style={{display:"inline-grid",placeItems:"center",textDecoration:"none",marginTop:24}}>[ OPEN TRADE TERMINAL ]</Link></section>
        </section>
        <div className="system-footer"><span>PRIVACY BOUNDARY IS EXPLICIT</span><span>PUBLIC POSITION STATE IS NOT YET VELA-PRIVATE</span></div>
      </div>
    </main>
  );
}
