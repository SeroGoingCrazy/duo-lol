// Riot account checks through the Python API (ADR-0004): the site never talks to Riot itself.
import { pythonFetch } from "@/lib/pythonApi";

export type RiotAccount = { puuid: string; riot_id: string; profile_icon_id: number };

export class RiotAccountError extends Error {}

/** Who a Riot ID is and the icon they wear right now (data/api.py riot_account). */
export async function riotAccount(riotId: string): Promise<RiotAccount> {
  const res = await pythonFetch(`/api/riot-accounts/${encodeURIComponent(riotId.trim())}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new RiotAccountError(typeof body.detail === "string" ? body.detail : "查询失败，请稍后再试");
  return body;
}

/** Start fetching a newly bound 会员's games (PRD-v2 §3.1 step 4); the result is cached for later. */
export function warmPlayer(riotId: string) {
  pythonFetch("/api/lookups", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ riot_id: riotId }),
  }).catch(() => {});   // best effort: the first 查组合 or 牌堆 will fetch them anyway
}
