"use client";
import { useT } from "@/components/LangProvider";
import { Badge } from "@/components/ui/badge";
import type { PlayerPreview } from "@/lib/api";

/** Identity and rank returned by Riot, before the match-history download has finished. */
export default function PlayerLookupPreview({ player }: { player: PlayerPreview }) {
  const t = useT();
  return (
    <div className="rounded-lg border bg-background/40 p-3" data-testid="lookup-player-preview">
      <div className="break-all text-sm font-semibold">{player.riot_id}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {player.tier !== undefined ? (
          <Badge>{t.tier(player.tier, player.division, player.league_points)}</Badge>
        ) : <span>{t("正在读取单双排段位…")}</span>}
        <span>{t("玩家信息已找到，战绩仍在读取中")}</span>
      </div>
    </div>
  );
}
