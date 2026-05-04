import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Industry Analyzer Demo",
  description: "Portfolio demo: upload CSV, auto-visualize, and chat with AI insights"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
