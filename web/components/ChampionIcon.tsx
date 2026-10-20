"use client";
import { useEffect, useState } from "react";
import { championIconUrl } from "@/lib/champions";

/** Square champion portrait; falls back to the name's first letter if there is no icon for it yet. */
export default function ChampionIcon({ champion, size = 40 }: { champion: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [champion]);

  const style = { width: size, height: size };
  if (failed) {
    return <span className="champ-icon placeholder" style={style} title={champion} aria-label={champion}>{champion[0]}</span>;
  }
  return (
    <img className="champ-icon" style={style} src={championIconUrl(champion)} alt={champion} title={champion}
      onError={() => setFailed(true)} />
  );
}
