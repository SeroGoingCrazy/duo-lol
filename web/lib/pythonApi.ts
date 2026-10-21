// Server-side calls from the website to the Python API (ADR-0004). In production the Python API only answers
// requests carrying DUO_INTERNAL_SECRET, so browsers reach it only through the routes this site allows.
export const API_URL = process.env.DUO_API_URL ?? "http://127.0.0.1:8000";

export function pythonFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (process.env.DUO_INTERNAL_SECRET) headers.set("x-duo-internal", process.env.DUO_INTERNAL_SECRET);
  return fetch(`${API_URL}${path}`, { cache: "no-store", ...init, headers });
}
