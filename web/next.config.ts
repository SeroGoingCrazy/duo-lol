import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// The Python API (data/api.py) does the work; app/api/[...path] forwards the browser's calls to it at runtime,
// so DUO_API_URL and DUO_INTERNAL_SECRET are read when the server runs, not baked in at build time.
export default function config(phase: string): NextConfig {
  return {
    // PGlite must load its WebAssembly from its own package folder.
    serverExternalPackages: ["@electric-sql/pglite"],
    // Builds and test servers must not overwrite a running developer's chunks.
    distDir: process.env.DUO_NEXT_DIST_DIR ?? (phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"),
  };
}
