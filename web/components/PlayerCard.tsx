"use client";
import ChampionIcon from "@/components/ChampionIcon";
import PositionIcon from "@/components/PositionIcon";
import { Badge } from "@/components/ui/badge";
import type { Player } from "@/lib/api";
import type { ChampionInfo } from "@/lib/champions";
import { tierLabel } from "@/lib/labels";

/** Who the result is about: rank, games this season and most-played champions, so people can check it's them. */
export default function PlayerCard({ player, role, info }: { player: Player; role?: string; info: Record<string, ChampionInfo> }) {
  const top = player.champions.slice(0, 4);
  return (
    <div className="min-w-0 rounded-lg border bg-background/40 p-3" data-testid="player-card">
      <div className="flex items-center gap-2">
        {role && <PositionIcon position={role} size={22} />}
        <span className="truncate font-semibold">{player.riot_id}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        <Badge>{tierLabel(player.tier, player.division, player.league_points)}</Badge>
        <Badge>本赛季 {player.games} 场</Badge>
        {player.insufficient_data && <Badge className="text-gold">数据不足，按自选英雄</Badge>}
      </div>
      {top.length > 0 && (
        <div className="mt-2 flex gap-1.5" aria-label="常用英雄">
          {top.map((c) => (
            <span key={`${c.champion}-${c.position}`} title={`${info[c.champion]?.name ?? c.champion} · ${c.games} 场 ${Math.round((c.wins / c.games) * 100)}% 胜率`}>
              <ChampionIcon champion={c.champion} size={28} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
