import Link from "next/link";
import SymbasisBrand from "@/components/SymbasisBrand";

export default function MarketingHome() {
  return (
    <main className="marketing-page marketing-v2">
      <div className="marketing-shell">
        <header className="marketing-top marketing-top-v2">
          <Link href="/" className="home-brand" aria-label="Symbasis home"><SymbasisBrand /></Link>
          <nav className="marketing-nav" aria-label="Symbasis">
            <Link href="/trade">TRADE</Link>
            <Link href="/markets">MARKETS</Link>
            <Link href="/portfolio">PORTFOLIO</Link>
            <Link href="/liquidity">LIQUIDITY</Link>
            <Link href="/mm">MM</Link>
            <Link href="/rewards">REWARDS</Link>
            <Link href="/more">MORE</Link>
          </nav>
          <div className="marketing-actions marketing-actions-v2">
            <span className="home-network"><i />HORIZEN TESTNET</span>
            <Link className="primary" href="/trade">LAUNCH TERMINAL →</Link>
          </div>
        </header>

        <section className="grant-hero">
          <div className="grant-copy">
            <div className="grant-meta"><span>■ &nbsp;01 / AUTONOMOUS PERPETUAL INFRASTRUCTURE</span><span>CHAIN 2651420 &nbsp;■</span></div>
            <h1>Private AI<br/>perpetual infrastructure<br/>for global markets.</h1>
            <p>Symbasis builds autonomous, on-chain market infrastructure powered by AI. Trade perpetuals with institutional-grade execution, private strategy commitments and verifiable testnet settlement.</p>
            <div className="grant-actions"><Link href="/trade" className="grant-primary">LAUNCH TERMINAL →</Link><Link href="/more">READ THE DOCUMENTATION ↗</Link></div>
          </div>

          <aside className="grant-system">
            <div className="system-grid">
              <div><span>ENGINE</span><strong>OPERATIONAL</strong><small><i/> ONLINE</small></div>
              <div><span>NETWORK</span><strong>HORIZEN</strong><small>TESTNET</small></div>
              <div><span>CHAIN ID</span><strong>2651420</strong></div>
              <div><span>MARKETS</span><strong>ETH / BTC</strong><small>+ MORE</small></div>
              <div><span>ORACLE MODE</span><strong>DEMO / STORK</strong><small>● ACTIVE</small></div>
              <div><span>BUILD</span><strong>v0.2.0</strong><small>TESTNET</small></div>
            </div>
            <div className="grant-mark" aria-hidden="true"><div className="grant-mark-inner"/></div>
            <div className="grant-caption">STRUCTURE BRINGS VOLATILITY INTO FOCUS.</div>
          </aside>
        </section>

        <section className="grant-capabilities">
          <div><strong>24/7</strong><span>AUTONOMOUS MARKETS</span></div>
          <div><strong>AI</strong><span>RISK & LIQUIDITY</span></div>
          <div><strong>PRIVATE</strong><span>STRATEGY COMMITMENTS</span></div>
          <div><strong>ON-CHAIN</strong><span>VERIFIABLE INFRASTRUCTURE</span></div>
        </section>

        <section className="home-black">
          <div className="home-black-kicker"><span>■ &nbsp;02 / BUILT FOR A MORE EFFICIENT FINANCIAL SYSTEM</span><span>MARKETS ARE MORE EFFICIENT ON-CHAIN &nbsp;■</span></div>
          <div className="home-black-grid">
            <div className="home-black-copy">
              <h2>There is structure<br/>inside volatility.</h2>
              <p>Symbasis makes it executable. A new class of on-chain markets, powered by AI, designed for performance, privacy and global access.</p>
              <Link href="/markets">EXPLORE THE ECOSYSTEM →</Link>
            </div>
            <div className="home-directory">
              <div className="directory-brand"><SymbasisBrand light/><span>PRIVATE AI PERPETUAL<br/>MARKET INFRASTRUCTURE</span></div>
              <div><b>PRODUCT</b><Link href="/trade">TRADE</Link><Link href="/markets">MARKETS</Link><Link href="/portfolio">PORTFOLIO</Link><Link href="/liquidity">LIQUIDITY</Link></div>
              <div><b>SYSTEMS</b><Link href="/mm">SYMBASIS MM</Link><Link href="/risk">RISK</Link><Link href="/private">PRIVATE MARKETS</Link><Link href="/rewards">TESTNET REWARDS</Link></div>
              <div><b>NETWORK</b><a href="https://explorer-testnet.horizen.io" target="_blank" rel="noreferrer">EXPLORER ↗</a><a href="https://hub-testnet.horizen.io/" target="_blank" rel="noreferrer">FAUCET ↗</a><Link href="/more">PROTOCOL INFORMATION</Link></div>
              <div><b>RESOURCES</b><Link href="/more">DOCUMENTATION ↗</Link><a href="https://github.com/mushee-io/Symbasis" target="_blank" rel="noreferrer">GITHUB ↗</a><Link href="/more">STATUS</Link></div>
            </div>
          </div>
          <div className="home-black-bottom"><span>SYMBASIS</span><span>© 2026 Symbasis. Testnet software.</span><span>Autonomous Markets for a More Open Financial System.</span></div>
        </section>
      </div>
    </main>
  );
}
