// The public 找搭子 demo (ADR-0008) shows Riot IDs on its cards, so it must never deal 会员: their Riot ID
// stays hidden until 互选. This route sits in front of the Python endpoint and adds them to `exclude`.
import { isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { forward, pythonFetch, unreachable } from "@/lib/pythonApi";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ detail: "参数不对" }, { status: 400 });
  const db = await getDb();
  const bound = await db.select({ puuid: schema.members.puuid, riotId: schema.members.riotId })
    .from(schema.members).where(isNotNull(schema.members.puuid));
  const { candidates: _ignored, ...rest } = body;   // only the server builds 会员 牌堆
  try {
    return forward(await pythonFetch("/api/recommendations", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...rest, exclude: bound.flatMap((m) => [m.puuid!, m.riotId!]) }),
    }));
  } catch {
    return unreachable();
  }
}
