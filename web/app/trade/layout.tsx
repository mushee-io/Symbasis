import TerminalNav from "@/components/TerminalNav";

export default function TradeLayout({ children }: { children: React.ReactNode }) {
  return <div className="sym-trade-route"><TerminalNav />{children}</div>;
}
