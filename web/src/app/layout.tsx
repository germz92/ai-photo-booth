import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/PwaRegister";
import { APP_NAME } from "@/lib/brand";
import { PWA_THEME_COLOR, pwaAppleWebApp } from "@/lib/pwa";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: APP_NAME,
  description: "Take a photo. We'll send your portrait.",
  manifest: "/api/pwa/manifest",
  appleWebApp: pwaAppleWebApp(),
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: PWA_THEME_COLOR,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
