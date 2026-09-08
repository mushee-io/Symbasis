"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SymbasisBrand from "./SymbasisBrand";

const links = [
  ["/trade", "Trade"],
  ["/markets", "Markets"],
  ["/portfolio", "Portfolio"],
  ["/liquidity", "Liquidity"],
  ["/mm", "MM"],
  ["/rewards", "Rewards"],
  ["/more", "More"]
] as const;

export default function TerminalNav() {
  const pathname = usePathname();
  return (
    <header className="sym-terminal-nav">
      <Link href="/" className="sym-nav-brand" aria-label="Symbasis home">
        <SymbasisBrand light compact />
      </Link>
      <nav className="sym-nav-links" aria-label="Symbasis terminal">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className={pathname === href || pathname.startsWith(`${href}/`) ? "is-active" : ""}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="sym-nav-actions">
        <span className="sym-network-state"><i /> HORIZEN TESTNET</span>
        <Link href="/private" className="sym-nav-utility">PRIVATE</Link>
        <Link href="/risk" className="sym-nav-utility">RISK</Link>
      </div>
    </header>
  );
}
