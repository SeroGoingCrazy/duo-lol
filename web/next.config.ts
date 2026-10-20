import type { NextConfig } from "next";

// The Python API (data/api.py) does the work; the site only proxies /api/* to it.
// `next build` bakes this URL in, so set DUO_API_URL before building, not only before `next start`.
const API_URL = process.env.DUO_API_URL ?? "http://127.0.0.1:8000";

const config: NextConfig = {
  // PGlite loads its WebAssembly from its own package folder, which bundling breaks (lib/db).
  serverExternalPackages: ["@electric-sql/pglite"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default config;
