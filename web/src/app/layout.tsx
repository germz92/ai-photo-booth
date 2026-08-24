import type { Metadata, Viewport } from "next";
import { APP_NAME } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Take a photo. We'll send your portrait.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
