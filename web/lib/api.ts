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
  score: number | null;   // 搭配评分 0-100; null until the score scale is fitted
  solo_baselines: { a: number; b: number };
  roles: { a: string; b: string };
  top_pairs: ChampionPair[];
  notes: string[];
};

export type Partner = {
  riot_id: string;
  tier: string;
  division: string | null;
  win_rate: number;
  win_rate_delta: number;
  score: number | null;
  roles: { a: string; b: string };
  top_pairs: ChampionPair[];
};

export type Pick = { champion: string; position: string };
export type SelfReport = { tier?: string; picks: Pick[] };

export const POSITIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;

export class ApiError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(typeof detail === "string" ? detail : describe(status));
  }
}

function describe(status: number) {
  if (status >= 500) return "服务器出错了，请稍后再试";
  if (status === 404) return "服务没有这个接口，请确认 Python API 是最新版本";
  return `请求没有成功（${status}），请检查输入后再试`;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  } catch {
    throw new ApiError(0, "连不上服务器，请确认网站和 Python API 都在运行");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.detail ?? body);
  return body as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A cached player comes back at once; otherwise the lookup runs as a job we poll until done. */
export async function ensurePlayer(riotId: string): Promise<Player> {
  const started = await call<{ job_id: string | null; player?: Player }>("/api/lookups", {
    method: "POST",
    body: JSON.stringify({ riot_id: riotId }),
  });
  if (started.player) return started.player;
  for (;;) {
    const job = await call<{ status: string; error?: string; player?: Player }>(`/api/lookups/${started.job_id}`);
    if (job.status === "done" && job.player) return job.player;
    if (job.status === "error") throw new ApiError(500, job.error ?? "查询失败，请稍后再试");
    await sleep(700);
  }
}

export function predictPair(a: string, b: string, aReport?: SelfReport, bReport?: SelfReport) {
  return call<PairResult>("/api/pair", {
    method: "POST",
    body: JSON.stringify({ a, b, a_self_report: aReport ?? null, b_self_report: bReport ?? null }),
  });
}

export function findPartners(riotId: string, report?: SelfReport) {
  return call<{ me: Player; partners: Partner[]; notes: string[] }>("/api/recommendations", {
    method: "POST",
    body: JSON.stringify({ riot_id: riotId, self_report: report ?? null }),
  });
}

export function listChampions() {
  return call<string[]>("/api/champions");
}

/** Same rule as service.riot_id_key: case and spaces around '#' don't matter. */
export function riotIdKey(id: string) {
  const i = id.lastIndexOf("#");
  return i < 0 ? id.trim().toLowerCase() : `${id.slice(0, i).trim()}#${id.slice(i + 1).trim()}`.toLowerCase();
}

export function riotIdProblem(id: string): string | null {
  const i = id.trim().lastIndexOf("#");
  if (!id.trim()) return null;
  if (i <= 0 || i === id.trim().length - 1) return "格式是 名字#标签，例如 Name#NA1";
  return null;
}

export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
/** 胜率差 in percentage points, e.g. "0.4 个百分点". */
export const points = (x: number) => `${Math.abs(x * 100).toFixed(1)} 个百分点`;
