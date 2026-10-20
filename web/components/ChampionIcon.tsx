"use client";
import { useEffect, useState } from "react";
import { championIconUrl, ddragonVersion } from "@/lib/champions";

/** Square champion portrait; falls back to the name's first letter if the image can't load. */
export default function ChampionIcon({ champion, size = 40 }: { champion: string; size?: number }) {
  const [ver, setVer] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { ddragonVersion().then(setVer); }, []);
  useEffect(() => setFailed(false), [champion, ver]);

  const style = { width: size, height: size };
  if (!ver || failed) {
    return <span className="champ-icon placeholder" style={style} title={champion} aria-label={champion}>{champion[0]}</span>;
  }
  return (
    <img className="champ-icon" style={style} src={championIconUrl(champion, ver)} alt={champion} title={champion}
      onError={() => setFailed(true)} />
  );
}
