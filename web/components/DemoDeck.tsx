"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import DeckStage from "@/components/DeckStage";
import LookupProgress from "@/components/LookupProgress";
import RiotIdField from "@/components/RiotIdField";
import SelfReportForm from "@/components/SelfReportForm";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError, ensurePlayer, findPartners, listChampions, riotIdProblem, type DeckCard, type Partner, type Player, type SelfReport } from "@/lib/api";
import { cardKey, DECK_SIZE, likesYou, loadSwipes, saveSwipes, type Swipe, type SwipeLog } from "@/lib/deck";
import { useChampionInfo } from "@/lib/useChampionInfo";
import { useT } from "@/components/LangProvider";

const asCard = (p: Partner): DeckCard => ({ ...p, id: cardKey(p) });

/** 找搭子 演示版 (ADR-0008) for visitors who are not yet swiping as a 会员: swipes stay in this browser. */
export default function DemoDeck({ notice }: { notice: React.ReactNode }) {
  const info = useChampionInfo();
  const t = useT();
  const [me, setMe] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [player, setPlayer] = useState<Player | null>(null);   // set while 数据不足 waits for 自选英雄
  const [deckOwner, setDeckOwner] = useState("");             // whose 牌堆 is showing
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [champions, setChampions] = useState<string[]>([]);
  const [log, setLog] = useState<SwipeLog>({ swipes: {}, lastPass: null });
  const [round, setRound] = useState(0);   // remounts the stage on 重新开始 or a new player
  const started = useRef(false);
  const ready = me.trim() !== "" && !riotIdProblem(me);

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
    setPlayer(null); setBusy(true); setLoading(t("正在从推荐池里准备你的牌堆…"));
    try {
      const out = await findPartners(p.riot_id, report, DECK_SIZE);
      setDeckOwner(p.riot_id);
      setLog(loadSwipes(p.riot_id));
      setRound((r) => r + 1);
      setPartners(out.partners); setNotes(out.notes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false); setLoading("");
    }
  }

  async function search(id: string) {
    setError(""); setPartners(null); setPlayer(null); setNotes([]); setBusy(true);
    const url = new URL(window.location.href);
    url.searchParams.set("me", id.trim());
    window.history.replaceState(null, "", url);
    try {
      setLoading(t("正在读取 {id} 本赛季的单双排对局…", { id: id.trim() }));
      const p = await ensurePlayer(id.trim());
      setLoading(""); setBusy(false);
      if (p.insufficient_data) setPlayer(p);   // ask for 自选英雄 first
      else await recommend(p);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
      setBusy(false); setLoading("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className={`${partners ? "mb-3 sm:mb-6" : "mb-6"} flex flex-wrap items-end justify-between gap-4`}>
        <div>
          <div className={`${partners ? "hidden sm:flex" : "flex"} mb-2 items-center gap-1.5 text-xs font-medium text-primary`}><Sparkles className="size-3.5" />{t("找到合拍的下一局")}</div>
          <h1 className="text-3xl font-bold tracking-tight">{t("找搭子")}</h1>
          <p className={`${partners ? "hidden sm:block" : ""} mt-2 text-sm text-muted-foreground`}>{t("看看搭配，选个队友。右滑喜欢，左滑跳过。")}</p>
        </div>
        {partners && <span className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground">{t("美服 · 单双排")} <span className="mx-1 text-border">/</span> {t("演示版")}</span>}
      </div>

      {/* once the deck is up, phones keep the card in view; the footnote below still says it is a demo */}
      <Alert className={`${partners ? "hidden sm:flex" : ""} mb-3 sm:mb-6`} data-testid="demo-notice">{notice}</Alert>

      <details open={partners ? undefined : true} className="mb-3 rounded-2xl border bg-card p-4 sm:mb-6" key={partners ? "loaded" : "search"}>
        <summary className="cursor-pointer text-sm font-medium">{partners ? <><span className="text-muted-foreground">{t("当前玩家")}</span> <span className="mx-2">{deckOwner}</span><span className="text-xs text-primary">{t("更换玩家")}</span></> : t("从你的 Riot ID 开始")}</summary>
        <form className="mt-3 flex flex-wrap items-start gap-3" onSubmit={(e) => { e.preventDefault(); if (ready && !busy) search(me); }}>
          <RiotIdField label={t("你的 Riot ID")} placeholder="Name#NA1" value={me} onChange={setMe} />
          <Button className="mt-5 w-full sm:w-auto" disabled={busy || !ready}>{t("开始滑卡")}</Button>
        </form>
      </details>

      <div className="space-y-3">
        {loading && <LookupProgress label={loading} hint={loading !== t("正在从推荐池里准备你的牌堆…") ? t("第一次查询的玩家大约需要 2 分钟，之后会缓存。") : undefined} />}
        {error && <Alert variant="error">{t.api(error)}</Alert>}
        {player && <SelfReportForm className="max-w-3xl" player={player} champions={champions} onSubmit={(r) => recommend(player, r)} />}
        {partners && partners.length === 0 && <Alert>{t("推荐池里暂时没有能和你一起排的玩家。")}</Alert>}
      </div>

      {partners && partners.length > 0 && (
        <DeckStage key={round} remaining={remaining} total={partners.length} mutual={mutual} likes={likes} info={info}
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
