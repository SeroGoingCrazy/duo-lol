// Chinese labels for Riot's position and tier codes; the API keeps the codes. Shown through lib/i18n.ts.

export const POSITION_LABELS: Record<string, string> = {
  TOP: "上单", JUNGLE: "打野", MIDDLE: "中单", BOTTOM: "下路", UTILITY: "辅助",
};

export const TIER_LABELS: Record<string, string> = {
  IRON: "黑铁", BRONZE: "青铜", SILVER: "白银", GOLD: "黄金", PLATINUM: "铂金", EMERALD: "翡翠",
  DIAMOND: "钻石", MASTER: "大师", GRANDMASTER: "宗师", CHALLENGER: "王者",
};

/** Tiers a 数据不足 + 未定级 player can pick for the 全服 win-rate prior (scoring needs one). */
export const SELF_REPORT_TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"];

export const POSITIONS = Object.keys(POSITION_LABELS);
