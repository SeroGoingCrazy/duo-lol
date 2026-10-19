import type { NextConfig } from "next";

// The Python API (data/api.py) does the work; the site only proxies /api/* to it.
const API_URL = process.env.DUO_API_URL ?? "http://127.0.0.1:8000";

const config: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default config;
