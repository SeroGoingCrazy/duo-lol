"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChampionIcon from "@/components/ChampionIcon";
import LookupProgress from "@/components/LookupProgress";
import PositionIcon from "@/components/PositionIcon";
import RiotIdField from "@/components/RiotIdField";
import { useT } from "@/components/LangProvider";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ApiError, ensurePlayer, recentGames, riotIdKey, riotIdProblem, type LookupUpdate, type Player, type RecentGame } from "@/lib/api";
import { championName } from "@/lib/champions";
import { useChampionInfo } from "@/lib/useChampionInfo";
import { cn } from "@/lib/utils";

/** 玩家资料页 body: looks the player up like 查组合 does (cached after the first time), then shows the profile. */
export default function PlayerProfile({ riotId }: { riotId: string }) {
  const t = useT();
  const info = useChampionInfo();
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [progress, setProgress] = useState<LookupUpdate | null>(null);
  const [games, setGames] = useState<RecentGame[]>([]);
  const [error, setError] = useState("");
  const [me, setMe] = useState("");

  useEffect(() => {
    let stale = false;
    setPlayer(null); setProgress(null); setGames([]); setError("");   // a client-side move to another player reuses this component
    (async () => {
      let p: Player;
      try {
        p = await ensurePlayer(riotId, (update) => { if (!stale) setProgress(update); });
      } catch (e) {
        if (!stale) setError(e instanceof ApiError ? e.message : String(e));
        return;
      }
      if (stale) return;
      setPlayer(p);
      // the profile stands on its own if only the game list fails
      recentGames(p.riot_id).then((g) => { if (!stale) setGames(g.games); })
        .catch((e) => { if (!stale) setError(e instanceof ApiError ? e.message : String(e)); });
    })();
    return () => { stale = true; };
  }, [riotId]);

  const same = me.includes("#") && riotIdKey(me) === riotIdKey(riotId);
  const canPair = me.trim() !== "" && !riotIdProblem(me) && !same;

  return (
    <>
      <h1 className="mb-1 break-all text-2xl font-bold tracking-tight lg:text-3xl" data-testid="player-title">{player?.riot_id ?? riotId}</h1>
      <p className="mb-5 text-sm text-muted-foreground">{t("美服 · 单双排")}</p>
      {!player && !error && <LookupProgress label={t("正在查询 {id}…", { id: riotId })} progress={progress} hint={t("第一次查询大约需要 2 分钟，之后会缓存。")} />}
      {error && <Alert variant="error">{t.api(error)}</Alert>}
      {player && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:items-start">
          <div className="space-y-4">
            <Card data-testid="player-summary">
              <div className="flex flex-wrap gap-2">
                <Badge>{t.tier(player.tier, player.division, player.league_points)}</Badge>
                <Badge>{t("本赛季 {n} 场", { n: player.games })}</Badge>
                {player.games > 0 && <Badge>{t("胜率 {wr}", { wr: t.pct(player.wins / player.games) })}</Badge>}
                {player.insufficient_data && <Badge className="text-gold">{t("数据不足")}</Badge>}
              </div>
              <CardTitle className="mt-4">{t("常用英雄")}</CardTitle>
              <ul className="space-y-2">
                {player.champions.map((c) => (
                  <li key={`${c.champion}-${c.position}`} className="flex items-center gap-3 text-sm">
                    <ChampionIcon champion={c.champion} size={32} />
                    <span className="min-w-0 flex-1 truncate font-medium">{championName(info, c.champion, t.lang)}</span>
                    <PositionIcon position={c.position} size={18} />
                    <span className="w-24 text-right tabular-nums text-muted-foreground">{t("{n} 场", { n: c.games })} · {Math.round((c.wins / c.games) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardTitle>{t("和 TA 查组合")}</CardTitle>
              <form className="flex flex-wrap items-start gap-3" onSubmit={(e) => {
                e.preventDefault();
                if (canPair) router.push(`/?${new URLSearchParams({ a: me.trim(), b: player.riot_id })}`);
              }}>
                <RiotIdField label={t("你的 Riot ID")} placeholder="Name#NA1" value={me} onChange={setMe}
                  error={same ? t("两个 Riot ID 是同一个人，请填另一位玩家") : null} />
                <Button className="mt-5" disabled={!canPair}>{t("预测")}</Button>
              </form>
            </Card>
          </div>
          <Card>
            <CardTitle>{t("最近对局")}</CardTitle>
            {games.length === 0 ? <p className="text-sm text-muted-foreground">{t("本赛季还没有单双排对局。")}</p> : (
              <ul className="divide-y" data-testid="recent-games">
                {games.map((g) => (
                  <li key={g.match_id} className="flex items-center gap-3 py-2 text-sm">
                    <span className={cn("w-1 self-stretch rounded-full", g.win ? "bg-good" : "bg-bad")} aria-hidden />
                    <ChampionIcon champion={g.champion} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{championName(info, g.champion, t.lang)}</div>
                      <div className="text-xs text-muted-foreground">
                        {[
                          g.game_creation && new Date(g.game_creation).toLocaleDateString(t.lang === "en" ? "en-US" : "zh-CN", { month: "short", day: "numeric" }),
                          g.game_duration && t("{m} 分钟", { m: Math.round(g.game_duration / 60) }),
                        ].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <PositionIcon position={g.position} size={18} />
                    <span className="w-20 text-right tabular-nums">{g.kills}/{g.deaths}/{g.assists}</span>
                    <span className={cn("w-10 text-right text-xs font-semibold", g.win ? "text-good" : "text-bad")}>{t(g.win ? "胜" : "负")}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
