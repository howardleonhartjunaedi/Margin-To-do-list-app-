import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Lets the dev server be opened as 127.0.0.1 too (a separate cookie jar from localhost).
  allowedDevOrigins: ["127.0.0.1"],
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
