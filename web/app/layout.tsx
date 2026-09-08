import type { Metadata } from "next";
import "./globals.css";
import "./symbasis.css";

export const metadata: Metadata = {
  title: "Symbasis — Autonomous Perpetual Markets",
  description: "AI-native perpetual market infrastructure on Horizen with autonomous liquidity, risk intelligence and confidential intent commitments."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
