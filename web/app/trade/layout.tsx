import TerminalNav from "@/components/TerminalNav";
import PremiumDepthBook from "@/components/PremiumDepthBook";
import LiveMarketSurface from "@/components/LiveMarketSurface";
import OnchainActivity from "@/components/OnchainActivity";
import "../trade-premium.css";
import "../trade-live.css";

export default function TradeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sym-trade-route">
      <TerminalNav />
      <PremiumDepthBook />
      <LiveMarketSurface />
      <OnchainActivity />
      {children}
    </div>
  );
}
