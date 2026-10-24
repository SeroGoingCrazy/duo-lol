"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSession } from "next-auth/react";
import ChampionPairTable from "@/components/ChampionPairTable";
import CopyButton from "@/components/CopyButton";
import PlayerCard from "@/components/PlayerCard";
import ScoreBadge, { ScoreCalculation, ScoreHelp, scoreSummary } from "@/components/ScoreBadge";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/LangProvider";
import { trackFunnel } from "@/lib/analytics";
import type { PairResult } from "@/lib/api";
import { useChampionInfo } from "@/lib/useChampionInfo";

// Share only the two IDs the visitor entered, never a bound member's identity or unrelated URL data.
function pairResultUrl([a, b]: [string, string]) {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("a", a); url.searchParams.set("b", b);
  return url.href;
}

/** shareable: the result came from the two Riot IDs alone, so ?a=&b= reproduces it (not when 自选英雄 were used). */
export default function PairResultView({ r, enteredIds, shareable = true }: { r: PairResult; enteredIds: [string, string]; shareable?: boolean }) {
  const info = useChampionInfo();
  const t = useT();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    getSession().then((session) => { if (live) setLoggedIn(!!session?.user); })
      .catch(() => { if (live) setLoggedIn(false); });
    return () => { live = false; };
  }, []);
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:items-start" data-testid="pair-result">
      <Card className="glass neon-ring">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">{t("搭配评分（百分位）")} <ScoreHelp /></div>
            <ScoreBadge score={r.score} />
            {r.score != null && <div className="mt-2 text-sm text-muted-foreground">{scoreSummary({ ...r, score: r.score }, t)}</div>}
          </div>
        </div>
        <ScoreCalculation prediction={r}>
          <p>{t("单排基线：{a} {pa}，{b} {pb}", { a: r.a.riot_id, pa: t.pct(r.solo_baselines.a), b: r.b.riot_id, pb: t.pct(r.solo_baselines.b) })}</p>
        </ScoreCalculation>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PlayerCard player={r.a} role={r.roles.a} info={info} />
          <PlayerCard player={r.b} role={r.roles.b} info={info} />
        </div>
        <div className="mt-4 space-y-3 border-t pt-4">
          {/* Retain the entered IDs even if same-page navigation clears the current query. */}
          {shareable && <>
            <p className="text-sm text-muted-foreground">{t("把这次组合结果发给 TA，邀请 TA 注册并加入推荐池。")}</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={() => `${t("来看看我们的组合！注册并加入推荐池，一起找搭子。")}\n${pairResultUrl(enteredIds)}`}
                label={t("邀请 TA 一起来")} onClick={() => trackFunnel("pair_invite_clicked", "public")} />
              <CopyButton text={() => pairResultUrl(enteredIds)} label={t("复制分享链接")} />
            </div>
          </>}
          {loggedIn === null ? <Button size="sm" disabled>{t("找更多像 TA 的搭子")}</Button>
            : <Button asChild size="sm"><Link href={loggedIn ? "/find" : "/login"} className="no-underline"
              onClick={() => trackFunnel("pair_find_more_clicked", "public")}>{t("找更多像 TA 的搭子")}</Link></Button>}
        </div>
      </Card>

      <Card>
        <CardTitle>{t("建议位置和最佳英雄组合")}</CardTitle>
        <ChampionPairTable a={r.a.riot_id} b={r.b.riot_id} roles={r.roles} pairs={r.top_pairs} info={info} />
      </Card>

      {r.notes.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground xl:col-span-2" data-testid="notes">
          {r.notes.map((x) => <li key={x}>* {t.api(x)}</li>)}
        </ul>
      )}
    </div>
  );
}
