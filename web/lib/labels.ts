// Chinese labels for Riot's position and tier codes; the API keeps the codes.

export const POSITION_LABELS: Record<string, string> = {
  TOP: "上单", JUNGLE: "打野", MIDDLE: "中单", BOTTOM: "下路", UTILITY: "辅助",
};

export const TIER_LABELS: Record<string, string> = {
  IRON: "黑铁", BRONZE: "青铜", SILVER: "白银", GOLD: "黄金", PLATINUM: "铂金", EMERALD: "翡翠",
  DIAMOND: "钻石", MASTER: "大师", GRANDMASTER: "宗师", CHALLENGER: "王者",
};

/** Tiers a 数据不足 + 未定级 player can pick for the 全服 win-rate prior (scoring needs one). */
export const SELF_REPORT_TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"];

const APEX = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

export const POSITIONS = Object.keys(POSITION_LABELS);

export const positionLabel = (p: string) => POSITION_LABELS[p] ?? p;

export function tierLabel(tier: string | null, division?: string | null, lp?: number | null) {
  if (!tier) return "未定级";
  const name = TIER_LABELS[tier] ?? tier;
  if (APEX.has(tier)) return lp != null ? `${name} ${lp} LP` : name;
  return division ? `${name} ${division}` : name;
}
