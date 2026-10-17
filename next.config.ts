import type { NextConfig } from 'next';

// Static export: the whole site is plain files, so it can be hosted anywhere with no server.
const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
};

export default nextConfig;
