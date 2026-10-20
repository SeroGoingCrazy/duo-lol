"use client";
import { useEffect, useState } from "react";
import { championIconUrl } from "@/lib/champions";
import { cn } from "@/lib/utils";

/** Square champion portrait; falls back to the name's first letter if there is no icon for it yet. */
export default function ChampionIcon({ champion, size = 40, className }: { champion: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [champion]);

  const style = { width: size, height: size };
  const base = cn("inline-flex shrink-0 items-center justify-center rounded-md bg-muted object-cover", className);
  if (failed) {
    return <span className={cn(base, "text-xs font-semibold text-muted-foreground")} style={style} aria-hidden>{champion[0]}</span>;
  }
  return <img className={base} style={style} src={championIconUrl(champion)} alt="" onError={() => setFailed(true)} />;
}
