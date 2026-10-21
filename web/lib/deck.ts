// 牌堆 demo (ADR-0008): before login exists, 喜欢 / 跳过 live in this browser and the other side's
// answer is simulated. Swapping these helpers for the PRD-v2 §6.1 endpoints leaves the UI unchanged.
import { riotIdKey, type Partner } from "@/lib/api";

export const DECK_SIZE = 200;   // ask for the whole ranked pool (data/api.py MAX_DECK)

export type Swipe = "like" | "pass";
export type SwipeLog = { swipes: Record<string, Swipe>; lastPass: string | null };

const EMPTY: SwipeLog = { swipes: {}, lastPass: null };
const storageKey = (me: string) => `duo-lol:swipes:${riotIdKey(me)}`;

export function loadSwipes(me: string): SwipeLog {
  try {
    const raw = window.localStorage.getItem(storageKey(me));
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function saveSwipes(me: string, log: SwipeLog) {
  try {
    window.localStorage.setItem(storageKey(me), JSON.stringify(log));
  } catch {
    // private window or blocked storage: swipes last until the page is closed
  }
}

/** Demo stand-in for the other player's 喜欢: a 搭配评分 of 50 or more (a better-than-average 组合).
 *  Before the score scale is fitted, a 预测胜率 of 50% or more plays the same role. */
export function likesYou(p: Pick<Partner, "score" | "win_rate">) {
  return p.score != null ? p.score >= 50 : p.win_rate >= 0.5;
}

export const cardKey = (p: Partner) => riotIdKey(p.riot_id);
