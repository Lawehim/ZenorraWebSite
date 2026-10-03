// Installable PWA (FR-GLOB-009).
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zenorra Limited — Real Estate & Solar",
    short_name: "Zenorra",
    description: "Verified land and property in Lagos, Ogun and Abuja, and practical solar energy solutions.",
    start_url: "/",
    display: "standalone",
    background_color: "#0E0D0B",
    theme_color: "#0E0D0B",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
