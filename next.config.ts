import type { NextConfig } from "next";

/* Waylay is one static page: no server, no API routes, nothing rendered on
   request. `next build` writes it to out/, ready for any static host.
   NEXT_PUBLIC_BASE_PATH serves it from a subfolder (a GitHub Pages
   project site); lib/base-path.ts reads the same variable for public/. */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
