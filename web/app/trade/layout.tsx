import TerminalNav from "@/components/TerminalNav";
import PremiumDepthBook from "@/components/PremiumDepthBook";
import "../trade-premium.css";

export default function TradeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sym-trade-route">
      <TerminalNav />
      <PremiumDepthBook />
      {children}
    </div>
  );
}
