// The browser's way to the Python API: only the endpoints the pages use, with the internal secret added.
// Everything else under /api/* is either a route of this site (more specific routes win) or not found,
// so Riot account checks and test-only endpoints stay server-side.
import { forward, pythonFetch, unreachable } from "@/lib/pythonApi";

const PUBLIC: [string, RegExp][] = [
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
  try {
    const res = await pythonFetch(`/api/${path}${new URL(req.url).search}`, {
      method: req.method,
      headers: { "content-type": "application/json" },
      body: req.method === "GET" ? undefined : await req.text(),
    });
    return forward(res);
  } catch {
    return unreachable();
  }
}

export const GET = proxy;
export const POST = proxy;
export const dynamic = "force-dynamic";
