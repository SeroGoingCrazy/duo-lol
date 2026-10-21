"use client";
import ChampionIcon from "@/components/ChampionIcon";
import { useT } from "@/components/LangProvider";
import { championName, type ChampionInfo } from "@/lib/champions";
import { cn } from "@/lib/utils";

/** Icon + name: Chinese with the English name underneath, or just English; the id if Data Dragon is unreachable. */
export default function ChampionLabel({ champion, info, size = 36, className }:
  { champion: string; info: Record<string, ChampionInfo>; size?: number; className?: string }) {
  const c = info[champion];
  const t = useT();
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)} data-champion={champion}>
      <ChampionIcon champion={champion} size={size} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-medium">{championName(info, champion, t.lang)}</span>
        {c && t.lang === "zh" && <span className="block truncate text-xs text-muted-foreground">{c.english}</span>}
      </span>
    </span>
  );
}
