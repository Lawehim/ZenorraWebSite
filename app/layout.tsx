import type { Metadata, Viewport } from "next";
import "./globals.css";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: "Zenorra Limited — Real Estate & Solar Energy", template: "%s · Zenorra" },
  description: "Verified land and property in Lagos, Ogun and Abuja, and practical solar energy solutions. Building Better Spaces. Powering a Brighter Future.",
  icons: { icon: "/brand/mark.webp" },
  openGraph: { type: "website", siteName: "Zenorra Limited", locale: "en_NG" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#0E0D0B", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus&family=Jost:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
