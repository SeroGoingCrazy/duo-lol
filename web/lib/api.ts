// Client for data/api.py. Terms follow CONTEXT.md (预测胜率, 胜率差, 组合加成 ...).

export type ChampionStat = { champion: string; position: string; games: number; wins: number };

export type Player = {
  riot_id: string;
  tier: string | null;
  division: string | null;
  league_points: number | null;
  unranked: boolean;
  games: number;
  insufficient_data: boolean;
  champions: ChampionStat[];
};

export type ChampionPair = {
  champion_a: string;
  champion_b: string;
  win_rate: number;
  pair_games: number;
};

export type PairResult = {
  a: Player;
  b: Player;
  win_rate: number;
  win_rate_delta: number;
  solo_baselines: { a: number; b: number };
  roles: { a: string; b: string };
  top_pairs: ChampionPair[];
  reasons: string[];
  notes: string[];
};

export type Partner = {
  riot_id: string;
  tier: string;
  win_rate: number;
  win_rate_delta: number;
  roles: { a: string; b: string };
  reasons: string[];
};

export type Pick = { champion: string; position: string };

export const POSITIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;

export class ApiError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(typeof detail === "string" ? detail : `请求失败（${status}）`);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.detail ?? body);
  return body as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cached player, or start a lookup and poll it until done. */
export async function ensurePlayer(riotId: string): Promise<Player> {
  try {
    return await call<Player>(`/api/players/${encodeURIComponent(riotId)}`);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 404) throw e;
  }
  const { job_id } = await call<{ job_id: string }>("/api/lookups", {
    method: "POST",
    body: JSON.stringify({ riot_id: riotId }),
  });
  for (;;) {
    const job = await call<{ status: string; error?: string; player?: Player }>(`/api/lookups/${job_id}`);
    if (job.status === "done" && job.player) return job.player;
    if (job.status === "error") throw new ApiError(500, job.error ?? "查询失败");
    await sleep(700);
  }
}

export function predictPair(a: string, b: string, aPicks?: Pick[], bPicks?: Pick[]) {
  return call<PairResult>("/api/pair", {
    method: "POST",
    body: JSON.stringify({
      a,
      b,
      a_self_report: aPicks?.length ? { picks: aPicks } : null,
      b_self_report: bPicks?.length ? { picks: bPicks } : null,
    }),
  });
}

export function findPartners(riotId: string) {
  return call<{ me: Player; partners: Partner[] }>(`/api/recommendations/${encodeURIComponent(riotId)}`);
}

export function listChampions() {
  return call<string[]>("/api/champions");
}

export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
export const signedPct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
