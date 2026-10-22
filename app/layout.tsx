import type { Metadata, Viewport } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import { EVENT, EVENT_SUMMARY } from "@/lib/event";
import "./globals.css";

// Same typefaces as westpoint.edu: Montserrat for headings, Open Sans for body
const montserrat = Montserrat({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-heading" });
const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-body" });

const description = `See the items donated so far. ${EVENT_SUMMARY}.`;

export const metadata: Metadata = {
  // Absolute base for link-preview image URLs; Vercel sets this env var
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000",
  ),
  title: `${EVENT.name} Preview`,
  description,
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    title: `${EVENT.name} Preview`,
    description,
    siteName: EVENT.name,
  },
  twitter: { card: "summary_large_image" },
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
