import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // The dev MCP endpoint keeps a log at .next/dev/logs/next-development.log. On this Windows
    // setup every write to it wakes Turbopack's watcher, so each request triggers a rebuild and
    // the open page reloads in a loop. Off until that's fixed upstream.
    mcpServer: false,
  },
  // PGlite loads its WASM and data files relative to its own module.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
