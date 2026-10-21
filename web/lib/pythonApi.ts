// Server-side calls from the website to the Python API (ADR-0004). In production the Python API only answers
// requests carrying DUO_INTERNAL_SECRET, so browsers reach it only through the routes this site allows.
export const API_URL = process.env.DUO_API_URL ?? "http://127.0.0.1:8000";

export function pythonFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (process.env.DUO_INTERNAL_SECRET) headers.set("x-duo-internal", process.env.DUO_INTERNAL_SECRET);
  return fetch(`${API_URL}${path}`, { cache: "no-store", ...init, headers });
}

/** Hand a Python response on to the browser: body, status and the headers that matter to it. */
export function forward(res: Response) {
  const headers = new Headers({ "content-type": res.headers.get("content-type") ?? "application/json" });
  for (const h of ["retry-after", "cache-control"]) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(res.body, { status: res.status, headers });
}

/** The Python API is down or cold-starting: a JSON error lib/api.ts can show. */
export const unreachable = () => Response.json({ detail: "连不上预测服务，请稍后再试" }, { status: 502 });
