"use client";
import { useEffect, useState } from "react";
import { championInfo, type ChampionInfo } from "@/lib/champions";

/** Chinese champion names once Data Dragon answers; until then (or offline) callers fall back to the id. */
export function useChampionInfo() {
  const [map, setMap] = useState<Record<string, ChampionInfo>>({});
  useEffect(() => { championInfo().then(setMap); }, []);
  return map;
}
