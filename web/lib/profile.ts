// 简介 and 现在想打 on a 会员's card, and the 牌堆 filters a 会员 sets (hard filters only, never the order: ADR-0006).
// Shared by the server and the browser, so no server imports here.

export const BIO_MAX = 140;
export const LOOKING_HOURS = 2;   // 现在想打 turns itself off after this, so stale "online" never lingers
export const LANGUAGES = ["en", "zh", "es", "pt", "ko", "vi", "tl", "fr"] as const;
export const LANGUAGE_LABELS: Record<string, string> = {
  en: "English", zh: "中文", es: "Español", pt: "Português", ko: "한국어", vi: "Tiếng Việt", tl: "Filipino", fr: "Français",
};
export const VOICES = ["voice", "text"] as const;   // 开麦 / 只打字
export const PLAY_TIMES = ["morning", "afternoon", "evening", "late_night"] as const;   // the 会员's own local time
export const PLAY_TIME_LABELS: Record<string, string> = { morning: "早上", afternoon: "下午", evening: "晚上", late_night: "深夜" };

export type Voice = (typeof VOICES)[number];
/** What a card shows about a 会员 besides the model's numbers. No contact details: those wait for 互选. */
export type MemberProfile = {
  bio: string; positions: string[]; languages: string[]; voice: Voice | null; play_times: string[]; looking_now: boolean;
};
/** 牌堆 filters. Empty lists mean "anyone". */
export type DeckFilter = { positions: string[]; languages: string[]; voice: boolean; looking_now: boolean };
export const NO_FILTER: DeckFilter = { positions: [], languages: [], voice: false, looking_now: false };

/** A 简介 must not carry a way to reach someone before 互选 (PRD-v2 §3.3): links, @handles, emails, Riot IDs,
 *  or a messaging app followed by a name. Cards also have 举报 for what slips through. */
const CONTACT = [
  /https?:\/\/|www\.|discord\.gg|\w\.(com|gg|io|me|net|org|tv)\b/i,
  /@\w/,
  /[\p{L}\p{N}]\s?#[\p{L}\p{N}]{3,5}(?![\p{L}\p{N}])/u,   // name#tag; "C# dev" or "top#10" are fine
  /(?<![\p{L}\p{N}])(discord|dc|ig|insta|instagram|twitter|snap|snapchat|tiktok|telegram|whatsapp|line|kakao|wechat|微信|vx|qq)(?![\p{L}\p{N}])\s*[:：]?\s*[\w.]*\d[\w.]*/iu,
];

export function bioProblem(bio: string): string | null {
  if (bio.length > BIO_MAX) return `简介最多 ${BIO_MAX} 个字`;
  for (const re of CONTACT) {
    const m = re.exec(bio);
    if (!m) continue;
    // quote the whole words around the match, so the 会员 can find it
    const start = bio.slice(0, m.index).search(/\S*$/);
    const end = m.index + m[0].length + (bio.slice(m.index + m[0].length).match(/^\S*/)?.[0].length ?? 0);
    return `简介里不能写联系方式或 Riot ID（“${bio.slice(start, end).trim()}”），互选后对方才看得到`;
  }
  return null;
}

/** The items of xs that are in allowed, once each. */
export const pick = <T extends string>(xs: unknown, allowed: readonly T[]) =>
  [...new Set((Array.isArray(xs) ? xs : []).filter((x): x is T => (allowed as readonly string[]).includes(x as string)))];

/** xs with x added, or removed if it was there. */
export const toggled = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

/** Whatever came in, as a valid DeckFilter. */
export function cleanFilter(f: Partial<DeckFilter> | null | undefined, positions: readonly string[]): DeckFilter {
  return {
    positions: pick(f?.positions, positions),
    languages: pick(f?.languages, LANGUAGES),
    voice: f?.voice === true,
    looking_now: f?.looking_now === true,
  };
}

/** Does this 会员 pass the filter? A candidate with no 想打的位置 fills any role, so passes a role filter;
 *  one who listed no language does not pass a language filter. */
export function passes(p: MemberProfile, f: DeckFilter) {
  if (f.positions.length && p.positions.length && !p.positions.some((x) => f.positions.includes(x))) return false;
  if (f.languages.length && !p.languages.some((x) => f.languages.includes(x))) return false;
  if (f.voice && p.voice !== "voice") return false;
  if (f.looking_now && !p.looking_now) return false;
  return true;
}

export const isFiltered = (f: DeckFilter) => f.positions.length > 0 || f.languages.length > 0 || f.voice || f.looking_now;
