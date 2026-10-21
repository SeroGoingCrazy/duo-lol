"use client";
import Link from "next/link";
import ChampionIcon from "@/components/ChampionIcon";
import PositionIcon from "@/components/PositionIcon";
import { Badge } from "@/components/ui/badge";
import { playerPath, type Player } from "@/lib/api";
import { championName, type ChampionInfo } from "@/lib/champions";
import { useT } from "@/components/LangProvider";

/** Who the result is about: rank, games this season and most-played champions, so people can check it's them. */
export default function PlayerCard({ player, role, info }: { player: Player; role?: string; info: Record<string, ChampionInfo> }) {
  const top = player.champions.slice(0, 4);
  const t = useT();
  return (
    <div className="min-w-0 rounded-lg border bg-background/40 p-3" data-testid="player-card">
      <div className="flex items-center gap-2">
        {role && <PositionIcon position={role} size={22} />}
        <Link href={playerPath(player.riot_id)} className="truncate font-semibold text-foreground" data-testid="player-link">{player.riot_id}</Link>
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        <Badge>{t.tier(player.tier, player.division, player.league_points)}</Badge>
        <Badge>{t("本赛季 {n} 场", { n: player.games })}</Badge>
        {player.insufficient_data && <Badge className="text-gold">{t("数据不足，按自选英雄")}</Badge>}
      </div>
      {top.length > 0 && (
        <div className="mt-2 flex gap-1.5" aria-label={t("常用英雄")}>
          {top.map((c) => (
            <span key={`${c.champion}-${c.position}`} title={t("{champ} · {n} 场 {wr}% 胜率", { champ: championName(info, c.champion, t.lang), n: c.games, wr: Math.round((c.wins / c.games) * 100) })}>
              <ChampionIcon champion={c.champion} size={28} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
