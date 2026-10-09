import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "TezDo'kon — tezkor onlayn savdo",
    template: "%s · TezDo'kon",
  },
  description: "AI yordamida sayt, Telegram bot va avtomatlashtirishlarni bir joyda yarating va boshqaring.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
