import TerminalNav from "@/components/TerminalNav";

export default function MMLayout({ children }: { children: React.ReactNode }) {
  return <div className="sym-mm-route"><TerminalNav />{children}</div>;
}
