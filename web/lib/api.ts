// Client for data/api.py. Terms follow CONTEXT.md (预测胜率, 胜率差, 组合加成 ...).
import type { DeckFilter, MemberProfile } from "@/lib/profile";

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
  reasons: string[];
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

/** 找搭子; limit = DECK_SIZE gives the whole ranked 牌堆 instead of the top 5. */
export function findPartners(riotId: string, report?: SelfReport, limit?: number) {
  return call<{ me: Player; partners: Partner[]; notes: string[] }>("/api/recommendations", {
    method: "POST",
    body: JSON.stringify({ riot_id: riotId, self_report: report ?? null, limit: limit ?? 5 }),
  });
}

/** One of a player's latest Solo/Duo games, for the 玩家资料页. */
export type RecentGame = {
  match_id: string; game_creation: number; game_duration: number; champion: string; position: string;
  win: boolean; kills: number; deaths: number; assists: number; cs: number;
};

export function recentGames(riotId: string) {
  return call<{ riot_id: string; games: RecentGame[] }>(`/api/players/${encodeURIComponent(riotId)}/matches`, { cache: "no-store" });
}

/** /player/Name-NA1, the 玩家资料页 (op.gg-style: a tag never contains "-", so the last one splits it). */
export function playerPath(riotId: string) {
  const i = riotId.lastIndexOf("#");
  return `/player/${encodeURIComponent(riotId.slice(0, i).trim())}-${encodeURIComponent(riotId.slice(i + 1).trim())}`;
}

export function riotIdFromSlug(slug: string): string | null {
  let s = slug;
  try { s = decodeURIComponent(slug); } catch { /* already decoded */ }
  const i = s.lastIndexOf("-");
  if (i <= 0 || i === s.length - 1) return null;
  return `${s.slice(0, i)}#${s.slice(i + 1)}`;
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


/** One 卡片 in a 牌堆. id is the 会员 id (or the Riot ID key in the demo); riot_id only after 互选. */
export type DeckCard = Omit<Partner, "riot_id"> & { id: string; riot_id?: string; discord?: string | null; profile?: MemberProfile };

// 会员 牌堆 (PRD-v2 §6.1), served by Next itself rather than the Python API.
export type Deck = {
  cards: DeckCard[]; likes_you: string[]; mutual: DeckCard[];
  likes_remaining: number; can_undo: boolean; retry_after: number | null;
  filter: DeckFilter; looking_until: string | null;
};
export type SwipeResult = { mutual_like: boolean; match: { riot_id: string; discord: string | null } | null; likes_remaining: number };

export const getDeck = () => call<Deck>("/api/deck", { cache: "no-store" });
export const postSwipe = (to: string, action: "like" | "pass") =>
  call<SwipeResult>("/api/swipes", { method: "POST", body: JSON.stringify({ to, action }) });
export const undoSwipe = () => call<{ undone: string }>("/api/swipes/undo", { method: "POST" });
export const cancelMutualLike = (other: string) =>
  call<{ ok: true }>("/api/mutual-likes", { method: "DELETE", body: JSON.stringify({ with: other }) });
export const blockMember = (to: string) => call<{ ok: true }>("/api/blocks", { method: "POST", body: JSON.stringify({ to }) });
export const reportMember = (to: string, reason: string, detail: string) =>
  call<{ ok: true }>("/api/reports", { method: "POST", body: JSON.stringify({ to, reason, detail }) });
export const saveDeckFilter = (filter: DeckFilter) =>
  call<Deck>("/api/deck/filter", { method: "POST", body: JSON.stringify(filter) });
export const setLooking = (on: boolean) =>
  call<{ looking_until: string | null }>("/api/looking", { method: "POST", body: JSON.stringify({ on }) });
export const saveSelfReport = (r: SelfReport) =>
  call<{ ok: true }>("/api/self-report", { method: "POST", body: JSON.stringify(r) });
