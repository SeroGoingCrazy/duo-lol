import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// The Python API (data/api.py) does the work; the site only proxies /api/* to it.
// `next build` bakes this URL in, so set DUO_API_URL before building, not only before `next start`.
const API_URL = process.env.DUO_API_URL ?? "http://127.0.0.1:8000";

export default function config(phase: string): NextConfig {
  return {
    // PGlite must load its WebAssembly from its own package folder.
    serverExternalPackages: ["@electric-sql/pglite"],
    // Builds and test servers must not overwrite a running developer's chunks.
    distDir: process.env.DUO_NEXT_DIST_DIR ?? (phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"),
    // fallback runs after every route, dynamic ones included, so /api/auth/[...nextauth] is served
    // by Next and only the remaining /api/* goes to Python.
    async rewrites() {
      return { beforeFiles: [], afterFiles: [], fallback: [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }] };
    },
  };
}
