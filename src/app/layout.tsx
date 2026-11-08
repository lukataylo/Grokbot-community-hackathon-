import type { Metadata, Viewport } from "next";
import { Familjen_Grotesk } from "next/font/google";
import "./globals.css";

const font = Familjen_Grotesk({ subsets: ["latin"], weight: ["400", "500"], variable: "--font", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_URL || "http://localhost:3000"),
  title: { default: "lumzel", template: "%s · lumzel" },
  description: "Every photo from your event, consent-checked and shared by morning.",
  icons: { icon: "/icons/favicon-32.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "lumzel", statusBarStyle: "default" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#FFFFFF" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={font.variable}>
      <body>{children}</body>
    </html>
  );
}
