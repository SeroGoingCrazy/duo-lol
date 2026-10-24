"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import DeckFilters from "@/components/DeckFilters";
import DeckStage from "@/components/DeckStage";
import LookupProgress from "@/components/LookupProgress";
import SelfReportForm from "@/components/SelfReportForm";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  ApiError, blockMember, cancelMutualLike, ensurePlayer, getDeck, listChampions, postSwipe, reportMember, saveSelfReport,
  saveDeckFilter, setLooking, undoSwipe, type Deck, type DeckCard, type LookupUpdate, type Player, type SelfReport,
} from "@/lib/api";
import { trackFunnel } from "@/lib/analytics";
import { isFiltered, LOOKING_HOURS, NO_FILTER, type DeckFilter } from "@/lib/profile";
import type { Swipe } from "@/lib/deck";
import { REPORT_REASONS } from "@/lib/reportReasons";
import { useChampionInfo } from "@/lib/useChampionInfo";
import { useT } from "@/components/LangProvider";

const RETRY_MAX_S = 600;   // empty 牌堆 retries back off up to this (PRD-v2 §2.1)
const FILTER_DEBOUNCE_MS = 400;

/** 找搭子 for a bound 会员 who 同意被推荐: real 喜欢 / 跳过 against other 会员 (PRD-v2 §3.2-3.4). */
export default function MemberDeck({ riotId }: { riotId: string }) {
  const info = useChampionInfo();
  const t = useT();
  // what is loading, kept as data so the label follows a language switch: the deck, or a Riot ID's lookup
  const [loading, setLoading] = useState<{ riotId?: string } | null>({ riotId });
  const [progress, setProgress] = useState<LookupUpdate | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const [waitingForPlayer, setWaitingForPlayer] = useState(false);
  const [emptyReason, setEmptyReason] = useState<Deck["empty_reason"]>(null);
  const [savingReport, setSavingReport] = useState(false);
  const [needPicks, setNeedPicks] = useState<Player | null>(null);
  const [champions, setChampions] = useState<string[]>([]);
  const [cards, setCards] = useState<DeckCard[] | null>(null);
  const [total, setTotal] = useState(0);
  const [likers, setLikers] = useState<Set<string>>(new Set());
  const [mutual, setMutual] = useState<DeckCard[]>([]);
  const [likesLeft, setLikesLeft] = useState<number | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [reporting, setReporting] = useState<DeckCard | null>(null);
  const [filter, setFilter] = useState<DeckFilter | null>(null);
  const [lookingUntil, setLookingUntil] = useState<Date | null>(null);
  const swiped = useRef(new Map<string, DeckCard>());   // so 撤销 can put the card back without a reload
  const backoff = useRef<{ wait: number; timer: ReturnType<typeof setTimeout> | null }>({ wait: 0, timer: null });
  const me = useRef<Player | null>(null);
  const latest = useRef(0);   // filter changes can overlap: only the newest deck request may land

  /** A revision belongs to the user's intent, including the debounce / serialized save wait. */
  const load = useCallback(async (quiet = false, fetchDeck: () => Promise<Deck> = getDeck, seq = ++latest.current, retryRequest?: () => void) => {
    if (seq !== latest.current) return;
    const b = backoff.current;
    if (b.timer) { clearTimeout(b.timer); b.timer = null; }
    if (!quiet) setLoading({});
    setError(""); setRetry(null); setWaitingForPlayer(false);
    try {
      const d = await fetchDeck();
      if (seq !== latest.current) return;
      setCards(d.cards); setTotal(d.cards.length); setLikers(new Set(d.likes_you)); setMutual(d.mutual);
      setLikesLeft(d.likes_remaining); setCanUndo(d.can_undo); setNeedPicks(null);
      setFilter(d.filter); setLookingUntil(d.looking_until ? new Date(d.looking_until) : null);
      setEmptyReason(d.empty_reason);
      trackFunnel("deck_loaded", "member");
      if (d.cards.length === 0) trackFunnel("deck_empty", "member");
      if (d.cards.length === 0 && d.retry_after) {
        b.wait = Math.min(RETRY_MAX_S, b.wait ? b.wait * 1.5 : d.retry_after);
        b.timer = setTimeout(() => load(true), b.wait * 1000);
      } else b.wait = 0;
    } catch (e) {
      if (seq !== latest.current) return;
      if (e instanceof ApiError && e.code === "not_cached") setWaitingForPlayer(true);
      else if (e instanceof ApiError && e.status === 422 && me.current) setNeedPicks(me.current);
      else {
        setError(e instanceof ApiError ? e.message : String(e));
        // Retry the same operation, including an intended filter that may not have been saved.
        setRetry(() => retryRequest ?? (() => { void load(false, fetchDeck); }));
      }
    } finally {
      if (seq === latest.current) setLoading(null);
    }
  }, []);

  const preparePlayer = useCallback(async () => {
    const seq = ++latest.current;
    if (backoff.current.timer) clearTimeout(backoff.current.timer);
    setLoading({ riotId }); setProgress(null); setError(""); setRetry(null); setWaitingForPlayer(false);
    try {
      const player = await ensurePlayer(riotId, (update) => { if (seq === latest.current) setProgress(update); });
      if (seq !== latest.current) return;
      me.current = player;
      await load(false, getDeck, seq);
    } catch (e) {
      if (seq !== latest.current) return;
      setError(e instanceof ApiError ? e.message : String(e));
      setRetry(() => () => { void preparePlayer(); });
      setLoading(null);
    }
  }, [riotId, load]);

  useEffect(() => {
    listChampions().then(setChampions).catch(() => setChampions([]));
    void preparePlayer();
    const b = backoff.current;
    return () => { latest.current++; if (b.timer) clearTimeout(b.timer); };
  }, [preparePlayer]);

  async function submitReport(report: SelfReport) {
    const seq = ++latest.current;
    if (backoff.current.timer) clearTimeout(backoff.current.timer);
    setError(""); setRetry(null); setLoading({}); setSavingReport(true);
    try {
      await saveSelfReport(report);
      if (seq === latest.current) await load(false, getDeck, seq);
    } catch (e) {
      if (seq !== latest.current) return;
      setError(e instanceof ApiError ? e.message : String(e));
      setRetry(() => () => { void submitReport(report); });
      setLoading(null);
    } finally { setSavingReport(false); }
  }

  const remove = (id: string) => {
    setCards((cs) => cs?.filter((c) => c.id !== id) ?? cs);
    setMutual((ms) => ms.filter((c) => c.id !== id));
  };

  // Optimistic like Tinder's web app: the card leaves at once and comes back if the server refuses.
  async function onSwipe(c: DeckCard, s: Swipe) {
    setCards((cs) => cs?.filter((x) => x.id !== c.id) ?? cs);
    swiped.current.set(c.id, c);
    try {
      const r = await postSwipe(c.id, s);
      setLikesLeft(r.likes_remaining);
      setCanUndo(s === "pass");
      setError("");
      trackFunnel("first_swipe", "member");
      if (!r.match) return null;
      trackFunnel("mutual_like", "member");
      const matched = { ...c, ...r.match };
      setMutual((ms) => [matched, ...ms]);
      setLikers((l) => { const n = new Set(l); n.delete(c.id); return n; });
      return matched;
    } catch (e) {
      setCards((cs) => (cs ? [c, ...cs] : [c]));
      setError(e instanceof ApiError ? e.message : String(e));
      return null;
    }
  }

  async function onUndo() {
    try {
      const { undone } = await undoSwipe();
      setCanUndo(false);
      const c = swiped.current.get(undone);
      if (c) { setCards((cs) => (cs ? [c, ...cs] : [c])); return undone; }
      await load(true);   // swiped in an earlier visit: reload to get the card back
      return undone;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      return null;
    }
  }

  // Preserve the desired filters on failure. Saves remain serialized and only the latest intent lands.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);
  function changeFilter(f: DeckFilter) {
    setFilter(f); setLoading({}); setError(""); setRetry(null); setWaitingForPlayer(false);
    const seq = ++latest.current;
    if (backoff.current.timer) clearTimeout(backoff.current.timer);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      const run = () => load(false, () => saveDeckFilter(f), seq, () => changeFilter(f));
      saving.current = saving.current.then(run, run);
    }, FILTER_DEBOUNCE_MS);
  }

  const looking = !!lookingUntil && lookingUntil > new Date();
  async function toggleLooking() {
    try {
      const r = await setLooking(!looking);
      setLookingUntil(r.looking_until ? new Date(r.looking_until) : null);
    } catch (e) { setError(e instanceof ApiError ? e.message : String(e)); }
  }

  async function act(fn: () => Promise<unknown>, id: string) {
    try { await fn(); remove(id); } catch (e) { setError(e instanceof ApiError ? e.message : String(e)); }
  }

  const small = "h-7 px-2 text-xs text-muted-foreground";
  const safety = (c: DeckCard) => <>
    <Button variant="ghost" className={small} onClick={() => act(() => blockMember(c.id), c.id)}>{t("拉黑")}</Button>
    <Button variant="ghost" className={small} onClick={() => setReporting(c)}>{t("举报")}</Button>
  </>;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2 sm:mb-6 sm:gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("找搭子")}</h1>
        </div>
        <div className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-2">
          {filter && (
            <Button variant={looking ? "default" : "outline"} className={looking ? "h-8 gap-2 rounded-full bg-good bg-none px-3 text-xs text-good-foreground shadow-none hover:bg-good/90" : "h-8 gap-2 rounded-full px-3 text-xs"}
              aria-pressed={looking} onClick={toggleLooking} data-testid="looking-toggle"
              title={looking ? t("{time} 前显示为现在想打，再点一下关掉", { time: lookingUntil!.toLocaleTimeString(t.lang === "en" ? "en-US" : "zh-CN", { hour: "numeric", minute: "2-digit" }) }) : t("别人会在卡片上看到你现在想打，{h} 小时后自动关掉", { h: LOOKING_HOURS })}>
              <span className={looking ? "size-2 rounded-full bg-good-foreground" : "size-2 rounded-full bg-muted-foreground/50"} />{t("现在想打")}
            </Button>
          )}
          <span className="w-full rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground sm:w-auto sm:py-1.5" data-testid="deck-owner">
            {riotId}{likesLeft != null && <><span className="mx-1 text-border">/</span>{t("今天还能喜欢 {n} 次", { n: likesLeft })}</>}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {loading && <div id="member-loading" className="space-y-3" data-testid="member-loading">
          <p className="text-sm font-medium">{t(loading.riotId ? "你的资料还在加载，完成后会自动查找搭子。" : "正在检查推荐池，请稍候。")}</p>
          {loading.riotId
            ? <LookupProgress label={t("正在查询 {id}…", { id: loading.riotId })} progress={progress} hint={t("第一次查询大约需要 2 分钟，之后会缓存。")} />
            : <LookupProgress label={t("正在从推荐池里准备你的牌堆…")} />}
        </div>}
        {waitingForPlayer && !loading && <Alert data-testid="member-waiting">
          <p className="font-semibold">{t("你的资料还没准备好")}</p>
          <p className="mt-1">{t("对局资料仍在读取，查看进度后会继续查找搭子。")}</p>
          <Button className="mt-3" onClick={() => void preparePlayer()}>{t("查看加载进度")}</Button>
        </Alert>}
        {filter && <fieldset disabled={savingReport || !!loading?.riotId}><DeckFilters filter={filter} onChange={changeFilter} /></fieldset>}
        {error && <Alert variant="error">
          <p>{t.api(error)}</p>
          {retry && <>
            <p className="mt-1">{t("已保留你的信息，可以直接重试。")}</p>
            <Button variant="outline" className="mt-3" disabled={!!loading} onClick={retry}>{t("重试")}</Button>
            {needPicks && <Button variant="outline" className="ml-2 mt-3" onClick={() => { setError(""); setRetry(null); }}>{t("修改自选英雄")}</Button>}
          </>}
        </Alert>}
        {needPicks && <fieldset disabled={!!loading || !!retry}><SelfReportForm className="max-w-3xl" player={needPicks} champions={champions}
          onSubmit={submitReport} /></fieldset>}
      </div>

      {cards && !loading && !waitingForPlayer && !needPicks && !retry && (
        <DeckStage remaining={cards} total={total} mutual={mutual} likes={cards.filter((c) => likers.has(c.id))} info={info}
          canUndo={canUndo} onSwipe={onSwipe} onUndo={onUndo} cardActions={safety} paused={!!reporting}
          mutualActions={(c) => <>
            <Button variant="ghost" className={small} onClick={() => act(() => cancelMutualLike(c.id), c.id)}>{t("取消互选")}</Button>
            {safety(c)}
          </>}
          empty={<>
            <p className="font-semibold">{t(emptyReason === "filtered" ? "当前筛选下没有搭子" : "暂时没有可推荐的搭子")}</p>
            <p className="text-sm text-muted-foreground">{t(emptyReason === "filtered"
              ? "筛选挡住了可推荐的会员，清除筛选、放宽条件后再看看。"
              : total > 0 ? "你已看完当前牌堆，可以重新查找，或先和朋友查组合。"
              : "暂时没有符合推荐条件的新会员。我们会自动检查，你也可以先和朋友查组合。")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {filter && isFiltered(filter) && <Button onClick={() => changeFilter(NO_FILTER)}>{t("一键清除筛选")}</Button>}
              <Button variant={emptyReason === "filtered" ? "outline" : "default"} asChild><a href={`/?a=${encodeURIComponent(riotId)}#duo-check`}>{t("和朋友查组合")}</a></Button>
              <Button variant="outline" onClick={() => void load()}>{t("重新查找")}</Button>
            </div>
          </>} />
      )}

      {reporting && <ReportDialog card={reporting} onClose={() => setReporting(null)}
        onSubmit={async (reason, detail) => { await act(() => reportMember(reporting.id, reason, detail), reporting.id); setReporting(null); }} />}
    </div>
  );
}

function ReportDialog({ card, onClose, onSubmit }: {
  card: DeckCard; onClose: () => void; onSubmit: (reason: string, detail: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const t = useT();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="report-title" data-testid="report-dialog">
      <Card className="w-full max-w-sm space-y-4">
        <CardTitle id="report-title">{t("举报 {who}", { who: card.riot_id || t("这名会员") })}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("举报会同时拉黑对方，管理员会人工处理。对方不会知道是谁举报的。")}</p>
        <fieldset className="space-y-2">
          <legend className="sr-only">{t("理由")}</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />{t(r)}
            </label>
          ))}
        </fieldset>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">{t("补充说明（可选）")}</span>
          <textarea className="w-full rounded-md border bg-background p-2 text-sm" rows={3} maxLength={500} value={detail} onChange={(e) => setDetail(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t("取消")}</Button>
          <Button disabled={busy} onClick={async () => { setBusy(true); await onSubmit(reason, detail); }}>{t("提交举报")}</Button>
        </div>
      </Card>
    </div>
  );
}
