import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Symbasis — Private AI Perpetuals",
  description: "AI-assisted perpetual trading on Horizen testnet with confidential strategy commitments."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
