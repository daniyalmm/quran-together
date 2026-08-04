import type { MetadataRoute } from "next";

// Required for compatibility with `output: "export"` in next.config.ts —
// without it, this route (a dynamic Route Handler under the hood) fails the
// static export build.
export const dynamic = "force-static";

// Mirrors next.config.ts — manifest icon/start_url/scope paths are literal
// strings the browser fetches directly, not resolved through Next's own
// basePath-aware link handling, so they need the same manual prefix.
const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const basePath = isGithubActions ? "/quran-together" : "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quran Together",
    short_name: "Quran Together",
    description: "Listen to the Quran and track your completion.",
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: "standalone",
    background_color: "#0A2119",
    theme_color: "#0A2119",
    icons: [
      {
        src: `${basePath}/icons/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${basePath}/icons/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${basePath}/icons/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `${basePath}/icons/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
