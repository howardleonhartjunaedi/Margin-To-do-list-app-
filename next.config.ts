import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // PGlite loads its WASM and data files relative to its own module.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
