"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import DeckStage from "@/components/DeckStage";
import LookupProgress from "@/components/LookupProgress";
import RiotIdField from "@/components/RiotIdField";
import SelfReportForm from "@/components/SelfReportForm";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError, ensurePlayer, findPartners, listChampions, riotIdKey, riotIdProblem, type DeckCard, type LookupUpdate, type Partner, type Player, type SelfReport } from "@/lib/api";
import { trackFunnel } from "@/lib/analytics";
import { cardKey, DECK_SIZE, likesYou, loadSwipes, saveSwipes, type Swipe, type SwipeLog } from "@/lib/deck";
import { useChampionInfo } from "@/lib/useChampionInfo";
import { useT } from "@/components/LangProvider";

type DemoFailure =
  | { stage: "lookup"; id: string }
  | { stage: "recommendation"; player: Player; report?: SelfReport };

const asCard = (p: Partner): DeckCard => ({ ...p, id: cardKey(p) });

/** 找搭子 演示版 (ADR-0008) for visitors who are not yet swiping as a 会员: swipes stay in this browser. */
export default function DemoDeck({ notice }: { notice: React.ReactNode }) {
  const info = useChampionInfo();
  const t = useT();
  const [me, setMe] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState("");
  const [progress, setProgress] = useState<LookupUpdate | null>(null);
  const [error, setError] = useState("");
  const [failure, setFailure] = useState<DemoFailure | null>(null);
  const [draft, setDraft] = useState<SelfReport | undefined>();
  const [player, setPlayer] = useState<Player | null>(null);   // set while 数据不足 waits for 自选英雄
  const [deckOwner, setDeckOwner] = useState("");             // whose 牌堆 is showing
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [champions, setChampions] = useState<string[]>([]);
  const [log, setLog] = useState<SwipeLog>({ swipes: {}, lastPass: null });
  const [round, setRound] = useState(0);   // remounts the stage on 重新开始 or a new player
  const started = useRef(false);
  const requestGeneration = useRef(0);
  const mounted = useRef(true);
  const ready = me.trim() !== "" && !riotIdProblem(me);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => { listChampions().then(setChampions).catch(() => setChampions([])); }, []);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const q = new URLSearchParams(window.location.search).get("me");
    if (q) { setMe(q); search(q); }
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = useMemo(() => (partners ?? []).filter((p) => !log.swipes[cardKey(p)]).map(asCard), [partners, log]);
  const mutual = (partners ?? []).filter((p) => log.swipes[cardKey(p)] === "like" && likesYou(p)).map(asCard);
  const likes = remaining.filter((c) => likesYou(c));

  function update(next: SwipeLog) {
    setLog(next);
    saveSwipes(deckOwner, next);
  }

  async function swiped(c: DeckCard, s: Swipe) {
    update({ swipes: { ...log.swipes, [c.id]: s }, lastPass: s === "pass" ? c.id : null });
    trackFunnel("first_swipe", "demo");
    if (s === "like" && likesYou(c)) trackFunnel("mutual_like", "demo");
    return s === "like" && likesYou(c) ? c : null;
  }

  async function undo() {
    const k = log.lastPass;
    if (!k) return null;
    const swipes = { ...log.swipes };
    delete swipes[k];
    update({ swipes, lastPass: null });
    return k;
  }

  function restart() {
    update({ swipes: {}, lastPass: null });
    setRound((r) => r + 1);
  }

  async function recommend(p: Player, report?: SelfReport) {
    const generation = ++requestGeneration.current;
    const active = () => mounted.current && generation === requestGeneration.current;
    setError(""); setFailure(null); setPlayer(p); setDraft(report);
    setBusy(true); setLoading(t("正在从推荐池里准备你的牌堆…"));
    try {
      const out = await findPartners(p.riot_id, report, DECK_SIZE);
      if (!active()) return;
      setDeckOwner(p.riot_id);
      setLog(loadSwipes(p.riot_id));
      setRound((r) => r + 1);
      setPartners(out.partners); setNotes(out.notes);
      trackFunnel("deck_loaded", "demo");
      if (out.partners.length === 0) trackFunnel("deck_empty", "demo");
    } catch (err) {
      if (!active()) return;
      setError(err instanceof ApiError ? err.message : String(err));
      setFailure({ stage: "recommendation", player: p, report });
    } finally {
      if (active()) { setBusy(false); setLoading(""); }
    }
  }

  async function search(id: string) {
    const generation = ++requestGeneration.current;
    const active = () => mounted.current && generation === requestGeneration.current;
    setError(""); setFailure(null); setDraft(undefined);
    setPartners(null); setPlayer(null); setNotes([]); setBusy(true); setProgress(null);
    const url = new URL(window.location.href);
    url.searchParams.set("me", id.trim());
    window.history.replaceState(null, "", url);
    try {
      setLoading(t("正在查询 {id}…", { id: id.trim() }));
      const p = await ensurePlayer(id.trim(), (update) => { if (active()) setProgress(update); });
      if (!active()) return;
      setLoading(""); setBusy(false);
      if (p.insufficient_data) setPlayer(p);   // ask for 自选英雄 first
      else await recommend(p);
    } catch (err) {
      if (!active()) return;
      setError(err instanceof ApiError ? err.message : String(err));
      setFailure({ stage: "lookup", id });
      setBusy(false); setLoading("");
    }
  }

  function changeId(value: string) {
    setMe(value);
    if (riotIdKey(me) === riotIdKey(value)) return;
    requestGeneration.current += 1;
    setBusy(false); setLoading(""); setProgress(null); setError(""); setFailure(null);
    setPlayer(null); setDraft(undefined); setPartners(null); setNotes([]);
  }

  function retry() {
    if (!failure || busy) return;
    if (failure.stage === "lookup") search(failure.id);
    else recommend(failure.player, failure.report);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className={`${partners ? "mb-2 sm:mb-6" : "mb-6"} flex flex-wrap items-end justify-between gap-2`}>
        <div>
          <div className={`${partners ? "hidden sm:flex" : "flex"} mb-2 items-center gap-1.5 text-xs font-medium text-primary`}><Sparkles className="size-3.5" />{t("找到合拍的下一局")}</div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("找搭子")}</h1>
          <p className={`${partners ? "hidden sm:block" : ""} mt-2 text-sm text-muted-foreground`}>{t("看看搭配，选个队友。右滑喜欢，左滑跳过。")}</p>
        </div>
        {partners && <span className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground">{t("美服 · 单双排")} <span className="mx-1 text-border">/</span> {t("演示版")}</span>}
      </div>

      {/* The full onboarding notice collapses once loaded; the simulation warning stays in view. */}
      <Alert className={`${partners ? "hidden sm:flex" : ""} mb-3 sm:mb-6`} data-testid="demo-notice">{notice}</Alert>
      {partners && <p className="mb-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-medium" data-testid="demo-simulation-notice">
        {t.lang === "zh" ? "演示：喜欢和互选均为模拟，不会通知对方。" : "Demo: likes and matches are simulated. Nobody is notified."}
      </p>}

      <details open={partners ? undefined : true} className="mb-2 rounded-2xl border bg-card px-3 py-2 sm:mb-6 sm:p-4" key={partners ? "loaded" : "search"}>
        <summary className="cursor-pointer text-sm font-medium">{partners ? <><span className="text-muted-foreground">{t("当前玩家")}</span> <span className="mx-2">{deckOwner}</span><span className="text-xs text-primary">{t("更换玩家")}</span></> : t("从你的 Riot ID 开始")}</summary>
        <form className="mt-3 flex flex-wrap items-start gap-3" onSubmit={(e) => { e.preventDefault(); if (ready && !busy) search(me); }}>
          <RiotIdField label={t("你的 Riot ID")} placeholder="Name#NA1" value={me} onChange={changeId} />
          <Button className="mt-5 w-full sm:w-auto" disabled={busy || !ready}>{t("开始滑卡")}</Button>
        </form>
      </details>

      <div className="space-y-3">
        {loading && <LookupProgress label={loading} progress={loading !== t("正在从推荐池里准备你的牌堆…") ? progress : undefined} hint={loading !== t("正在从推荐池里准备你的牌堆…") ? t("第一次查询的玩家大约需要 2 分钟，之后会缓存。") : undefined} />}
        {error && <Alert variant="error">
          <p>{t.api(error)}</p>
          <p className="mt-1">{t("输入和已加载的资料已保留，可以直接重试。")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={retry}>{t(failure?.stage === "recommendation" ? "重试推荐" : "重试查询")}</Button>
            {failure?.stage === "recommendation" && player?.insufficient_data && <Button variant="outline" onClick={() => { setError(""); setFailure(null); }}>{t("修改自选英雄")}</Button>}
          </div>
        </Alert>}
        {player?.insufficient_data && !busy && !failure && !partners && <SelfReportForm className="max-w-3xl" player={player} champions={champions} initial={draft} onSubmit={(r) => recommend(player, r)} />}
        {partners && partners.length === 0 && <Alert>{t("推荐池里暂时没有能和你一起排的玩家。")}</Alert>}
      </div>

      {partners && partners.length > 0 && (
        <DeckStage key={round} demo remaining={remaining} total={partners.length} mutual={mutual} likes={likes} info={info}
          canUndo={!!log.lastPass} onSwipe={swiped} onUndo={undo}
          empty={<>
            <p className="font-semibold">{t("暂时没有更多搭子了")}</p>
            <p className="text-sm text-muted-foreground">{t("推荐池有新玩家时会出现新的卡片。也可以去查组合，直接算你和某个人的分数。")}</p>
            <div className="flex gap-2">
              <Button variant="outline" asChild><a href="/">{t("去查组合")}</a></Button>
              <Button variant="outline" onClick={restart}>{t("重新开始")}</Button>
            </div>
          </>} />
      )}

      {notes.map((n) => <p key={n} className="mt-3 text-xs text-muted-foreground">* {t.api(n)}</p>)}
      {partners && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("演示版：滑卡记录只存在这个浏览器里；搭配评分 50 以上的玩家视为也喜欢了你。")}
        </p>
      )}
    </div>
  );
}
