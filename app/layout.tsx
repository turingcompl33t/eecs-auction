import type { Metadata, Viewport } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import "./globals.css";

// Same typefaces as westpoint.edu: Montserrat for headings, Open Sans for body
const montserrat = Montserrat({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-heading" });
const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "EECS Auction 2026 Preview",
  description: "A preview of the items donated so far to the EECS Auction 2026.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${openSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
