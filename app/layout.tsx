import type { Metadata } from "next";
import { Instrument_Serif, Inter_Tight, Geist_Mono } from "next/font/google";
import "./globals.css";

const serif = Instrument_Serif({ variable: "--serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const sans = Inter_Tight({ variable: "--sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "YouMirror · Should I buy this?",
  description: "Before you buy, ask the mirror. It reads your skin today, tries the product on you, and tells you to buy, skip or swap, with reasons.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
