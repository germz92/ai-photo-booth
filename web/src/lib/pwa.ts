import type { Metadata, MetadataRoute } from "next";
import { APP_NAME } from "./brand";

export const PWA_THEME_COLOR = "#0a0a0a";
export const PWA_BACKGROUND_COLOR = "#0a0a0a";
export const PWA_MANIFEST_PATH = "/api/pwa/manifest";

export function pwaManifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_NAME,
    short_name: "Lumetry",
    description: "Take a photo. We'll send your portrait.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLOR,
    categories: ["photo", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

export function pwaAppleWebApp(): NonNullable<Metadata["appleWebApp"]> {
  return {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "black-translucent",
  };
}
