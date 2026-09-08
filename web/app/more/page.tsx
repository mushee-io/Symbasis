import TerminalNav from "@/components/TerminalNav";

const items = [
  ["01", "ARCHITECTURE", "Deployed contracts, execution path, privacy boundary and reviewer proof.", "/architecture"],
  ["02", "LIVE READINESS", "Server-side Horizen chain, bytecode, oracle and smoke-test readiness report.", "/api/grant-readiness"],
  ["03", "DOCUMENTATION", "Protocol architecture, deployment and integration notes.", "https://github.com/mushee-io/Symbasis"],
  ["04", "STATUS", "Frontend configuration health check.", "/api/health"],
  ["05", "MARKET MAKER", "Symbasis MM architecture and testnet simulation layer.", "/mm"],
  ["06", "EXPLORER", "Inspect Symbasis transactions and contracts on Horizen.", "https://explorer-testnet.horizen.io"],
  ["07", "FAUCET", "Get Horizen testnet ETH for interaction.", "https://hub-testnet.horizen.io/"],
  ["08", "SOURCE", "Open-source contracts, web terminal, tests and CI workflow.", "https://github.com/mushee-io/Symbasis"]
];

export default function MorePage() {
  return (
    <main className="terminal-page">
      <TerminalNav />
      <div className="terminal-shell">
        <section className="terminal-header"><div><div className="terminal-kicker">09 / PROTOCOL RESOURCES</div><h1>MORE</h1></div><p>Technical entry points for developers, grant reviewers and testnet participants. Deployment proof and limitations are public.</p></section>
        <section className="more-grid">
          {items.map(([n,title,desc,href]) => <a key={title} href={href} target={href.startsWith("http")?"_blank":undefined} rel={href.startsWith("http")?"noreferrer":undefined}><span>{n} / RESOURCE</span><h2>{title}</h2><p>{desc}</p></a>)}
        </section>
        <section className="page-grid single"><div className="data-region"><div className="region-head"><span>PROTOCOL DISCLOSURE</span><strong>TESTNET SOFTWARE</strong></div><div style={{padding:24,color:"#8b8b8e",font:"500 11px/1.7 var(--sym-mono)"}}>Perpetual futures are high-risk derivatives. Symbasis is currently testnet software and has not received a professional smart-contract audit. Demo-oracle and market-maker data are simulations and must not be represented as real liquidity, real volume or real counterparties. Shared VELA testnet privacy is not yet available, so public position state is not confidential today.</div></div></section>
        <div className="system-footer"><span>SYMBASIS / VERIFIABLE HORIZEN TESTNET INFRASTRUCTURE</span><span>VERSION 0.2 TESTNET</span></div>
      </div>
    </main>
  );
}
