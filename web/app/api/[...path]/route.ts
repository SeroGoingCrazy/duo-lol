// The browser's way to the Python API: only the endpoints the pages use, with the internal secret added.
// Everything else under /api/* is either a route of this site (more specific routes win) or not found,
// so Riot account checks and test-only endpoints stay server-side.
import { pythonFetch } from "@/lib/pythonApi";

const PUBLIC: [string, RegExp][] = [
  ["GET", /^players\/[^/]+$/],
  ["POST", /^lookups$/],
  ["GET", /^lookups\/[^/]+$/],
  ["POST", /^pair$/],
  ["GET", /^champions$/],
];

async function proxy(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.map(encodeURIComponent).join("/");
  if (!PUBLIC.some(([m, re]) => m === req.method && re.test(path))) {
    return Response.json({ detail: "Not Found" }, { status: 404 });
  }
  const res = await pythonFetch(`/api/${path}`, {
    method: req.method,
    headers: { "content-type": "application/json" },
    body: req.method === "GET" ? undefined : await req.text(),
  });
  return new Response(res.body, { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "application/json" } });
}

export const GET = proxy;
export const POST = proxy;
export const dynamic = "force-dynamic";
