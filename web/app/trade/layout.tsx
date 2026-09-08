import TerminalNav from "@/components/TerminalNav";
import PremiumDepthBook from "@/components/PremiumDepthBook";
import LiveMarketSurface from "@/components/LiveMarketSurface";
import OnchainActivity from "@/components/OnchainActivity";
import OrderIntentControls from "@/components/OrderIntentControls";
import "../trade-premium.css";
import "../trade-live.css";
import "../trade-order-intents.css";

export default function TradeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sym-trade-route">
      <TerminalNav />
      <PremiumDepthBook />
      <LiveMarketSurface />
      <OnchainActivity />
      <OrderIntentControls />
      {children}
    </div>
  );
}
