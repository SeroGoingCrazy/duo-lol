"use client";
import ChampionLabel from "@/components/ChampionLabel";
import PositionIcon from "@/components/PositionIcon";
import { pct, type ChampionPair } from "@/lib/api";
import type { ChampionInfo } from "@/lib/champions";
import { positionLabel } from "@/lib/labels";

/** 建议位置 sits in the header, above each player's champion column, so the two line up. */
export default function ChampionPairTable({ a, b, roles, pairs, info }: {
  a: string; b: string; roles: { a: string; b: string }; pairs: ChampionPair[]; info: Record<string, ChampionInfo>;
}) {
  const head = (id: string, role: string) => (
    <th className="px-2 py-2 text-left font-normal">
      <span className="flex items-center gap-2">
        <PositionIcon position={role} size={24} />
        <span className="min-w-0 leading-tight">
          <span className="block font-semibold text-foreground">{positionLabel(role)}</span>
          <span className="block truncate text-xs text-muted-foreground">{id}</span>
        </span>
      </span>
    </th>
  );
  return (
    <table className="w-full table-fixed border-collapse text-sm" data-testid="top-pairs">
      <thead data-testid="roles" className="border-b">
        <tr>
          {head(a, roles.a)}
          {head(b, roles.b)}
          <th className="w-24 px-2 py-2 text-right text-xs font-normal text-muted-foreground">预测胜率</th>
        </tr>
      </thead>
      <tbody>
        {pairs.map((p) => (
          <tr key={`${p.champion_a}-${p.champion_b}`} className="border-b last:border-0">
            <td className="px-2 py-2.5"><ChampionLabel champion={p.champion_a} info={info} /></td>
            <td className="px-2 py-2.5"><ChampionLabel champion={p.champion_b} info={info} /></td>
            <td className="px-2 py-2.5 text-right">
              <div className="font-semibold tabular-nums">{pct(p.win_rate)}</div>
              <div className="text-xs text-muted-foreground">全服 {p.pair_games.toLocaleString()} 局</div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
