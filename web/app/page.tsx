import Link from "next/link";
import SymbasisBrand from "@/components/SymbasisBrand";

export default function MarketingHome() {
  return (
    <main className="marketing-page">
      <div className="marketing-shell">
        <header className="marketing-top">
          <div><SymbasisBrand /></div>
          <div className="marketing-actions">
            <Link href="/more">DOCUMENTATION ↗</Link>
            <Link className="primary" href="/trade">LAUNCH TERMINAL</Link>
          </div>
        </header>

        <section className="hero-grid">
          <div className="hero-copy">
            <i className="registration a"/><i className="registration b"/><i className="registration c"/><i className="registration d"/>
            <div className="hero-meta">
              <span>01 / AUTONOMOUS PERPETUAL INFRASTRUCTURE</span>
              <span>HORIZEN TESTNET · CHAIN 2651420</span>
            </div>
            <h1 className="hero-word">SYMBASIS</h1>
            <h2 className="hero-tagline">AUTONOMOUS<br/>LIQUIDITY.<br/>PERPETUAL MARKETS.</h2>
            <p className="hero-description">
              A testnet-first perpetual exchange with AI-assisted risk intelligence, programmable liquidity infrastructure and confidential strategy commitments. Built for direct interaction with market structure.
            </p>
            <div className="hero-cta">
              <Link href="/trade" className="primary">[ LAUNCH TERMINAL ]</Link>
              <Link href="/mm">[ SYMBASIS MM ↗ ]</Link>
            </div>
          </div>

          <aside className="hero-visual">
            <div className="hero-telemetry">
              <div><span>ENGINE</span><strong>OPERATIONAL</strong></div>
              <div><span>NETWORK</span><strong>HORIZEN</strong></div>
              <div><span>MARKETS</span><strong>ETH / BTC</strong></div>
              <div><span>ORACLE MODE</span><strong>DEMO / STORK</strong></div>
            </div>
            <div className="liquidity-field" aria-label="Computational liquidity field">
              <div className="liquidity-axis"/><div className="liquidity-mid"/><div className="particle-cloud"/>
            </div>
            <div className="visual-caption">
              <span>LIVE LIQUIDITY FIELD / TESTNET SIMULATION</span>
              <span>SPREAD · DEPTH · INVENTORY · QUOTES</span>
            </div>
          </aside>
        </section>

        <section className="editorial-strip">
          <article><b>02 / EXECUTION</b><h3>PERPETUALS</h3><p>Isolated-margin long and short positions with bounded slippage, liquidation logic and onchain settlement.</p></article>
          <article><b>03 / INTELLIGENCE</b><h3>RISK ENGINE</h3><p>Explainable pre-trade analysis for leverage, liquidation distance, collateral concentration and volatility.</p></article>
          <article><b>04 / LIQUIDITY</b><h3>SYMBASIS MM</h3><p>Autonomous market-simulation infrastructure for spreads, depth, quote flow and testnet execution.</p></article>
          <article><b>05 / PRIVACY</b><h3>MANDATES</h3><p>Raw strategy instructions remain offchain while commitments and later execution attestations are anchored onchain.</p></article>
        </section>

        <footer className="marketing-footer">
          <h2>There is structure inside volatility.<br/>Symbasis makes it executable.</h2>
          <div className="footer-grid">
            <div><SymbasisBrand/><span style={{marginTop: 18}}>PRIVATE AI PERPETUAL MARKET INFRASTRUCTURE</span></div>
            <div><span>PRODUCT</span><Link href="/trade">Trade</Link><Link href="/markets">Markets</Link><Link href="/portfolio">Portfolio</Link><Link href="/liquidity">Liquidity</Link></div>
            <div><span>SYSTEMS</span><Link href="/mm">Symbasis MM</Link><Link href="/risk">Risk</Link><Link href="/private">Private Mandates</Link><Link href="/rewards">Testnet Rewards</Link></div>
            <div><span>NETWORK</span><a href="https://explorer-testnet.horizen.io" target="_blank" rel="noreferrer">Explorer ↗</a><a href="https://hub-testnet.horizen.io/" target="_blank" rel="noreferrer">Faucet ↗</a><Link href="/more">Protocol Information</Link></div>
          </div>
        </footer>
      </div>
    </main>
  );
}
