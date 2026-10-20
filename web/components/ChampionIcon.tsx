"use client";
import { useEffect, useState } from "react";
import { championIconUrl, ddragonVersion } from "@/lib/champions";
import { cn } from "@/lib/utils";

/** Square champion portrait; falls back to the name's first letter if the image can't load. */
export default function ChampionIcon({ champion, size = 40, className }: { champion: string; size?: number; className?: string }) {
  const [ver, setVer] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { ddragonVersion().then(setVer); }, []);
  useEffect(() => setFailed(false), [champion, ver]);

  const style = { width: size, height: size };
  const base = cn("inline-flex shrink-0 items-center justify-center rounded-md bg-muted object-cover", className);
  if (!ver || failed) {
    return <span className={cn(base, "text-xs font-semibold text-muted-foreground")} style={style} aria-hidden>{champion[0]}</span>;
  }
  return <img className={base} style={style} src={championIconUrl(champion, ver)} alt="" onError={() => setFailed(true)} />;
}
