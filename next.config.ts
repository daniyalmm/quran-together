import type { NextConfig } from "next";

// GitHub Pages serves this as a project site at /quran-together/, so the
// build needs a matching basePath — but only in CI (GITHUB_ACTIONS is set
// automatically by the Actions runner), not for local `next dev`/`build`.
const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const basePath = isGithubActions ? "/quran-together" : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
