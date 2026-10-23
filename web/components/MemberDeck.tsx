"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import DeckFilters from "@/components/DeckFilters";
import DeckStage from "@/components/DeckStage";
import LookupProgress from "@/components/LookupProgress";
import SelfReportForm from "@/components/SelfReportForm";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  ApiError, blockMember, cancelMutualLike, ensurePlayer, getDeck, listChampions, postSwipe, reportMember, saveSelfReport,
  saveDeckFilter, setLooking, undoSwipe, type Deck, type DeckCard, type LookupUpdate, type Player,
} from "@/lib/api";
import { trackFunnel } from "@/lib/analytics";
import { isFiltered, LOOKING_HOURS, type DeckFilter } from "@/lib/profile";
import type { Swipe } from "@/lib/deck";
import { REPORT_REASONS } from "@/lib/reportReasons";
import { useChampionInfo } from "@/lib/useChampionInfo";
import { useT } from "@/components/LangProvider";

const RETRY_MAX_S = 600;
const FILTER_DEBOUNCE_MS = 400;   // a burst of chip clicks makes one save and one re-score   // an empty 牌堆 retries with 1.5x backoff up to this (PRD-v2 §2.1)

/** 找搭子 for a bound 会员 who 同意被推荐: real 喜欢 / 跳过 against other 会员 (PRD-v2 §3.2-3.4). */
export default function MemberDeck({ riotId }: { riotId: string }) {
  const info = useChampionInfo();
  const t = useT();
  // what is loading, kept as data so the label follows a language switch: the deck, or a Riot ID's lookup
  const [loading, setLoading] = useState<{ riotId?: string } | null>(null);
  const [progress, setProgress] = useState<LookupUpdate | null>(null);
  const [error, setError] = useState("");
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

  /** Fetch and show the 牌堆; fetchDeck replaces the plain GET (a filter save returns the deck it gives). */
  const load = useCallback(async (quiet = false, fetchDeck?: () => Promise<Deck>, onFail?: () => void) => {
    if (!quiet) setLoading({});
    const seq = ++latest.current;
    try {
      const d = await (fetchDeck ?? getDeck)();
      if (seq !== latest.current) return;
      setCards(d.cards); setTotal(d.cards.length); setLikers(new Set(d.likes_you)); setMutual(d.mutual);
      setLikesLeft(d.likes_remaining); setCanUndo(d.can_undo); setNeedPicks(null); setError("");
      setFilter(d.filter); setLookingUntil(d.looking_until ? new Date(d.looking_until) : null);
      trackFunnel("deck_loaded", "member");
      const b = backoff.current;
      if (b.timer) clearTimeout(b.timer);
      if (d.cards.length === 0 && d.retry_after) {
        b.wait = Math.min(RETRY_MAX_S, b.wait ? b.wait * 1.5 : d.retry_after);
        b.timer = setTimeout(() => load(true), b.wait * 1000);
      } else b.wait = 0;
    } catch (e) {
      if (seq !== latest.current) return;
      onFail?.();
      if (e instanceof ApiError && e.status === 422 && me.current) setNeedPicks(me.current);
      else setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      if (seq === latest.current) setLoading(null);
    }
  }, []);

  useEffect(() => {
    listChampions().then(setChampions).catch(() => setChampions([]));
    (async () => {
      try {
        setLoading({ riotId }); setProgress(null);
        me.current = await ensurePlayer(riotId, setProgress);
        await load();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : String(e));
        setLoading(null);
      }
    })();
    const b = backoff.current;
    return () => { if (b.timer) clearTimeout(b.timer); };
  }, [riotId, load]);   // eslint-disable-line react-hooks/exhaustive-deps

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

  // Chips update at once; the save waits for a pause in clicking, and saves go out one at a time so the
  // last one is what the server keeps. A failed save puts the chips back to what the server has.
  const saved = useRef<DeckFilter | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => { if (filter && !saveTimer.current) saved.current = filter; }, [filter]);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);
  function changeFilter(f: DeckFilter) {
    setFilter(f);
    latest.current++;   // a deck still loading for the old filter must not land
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      const run = () => load(false, () => saveDeckFilter(f), () => setFilter(saved.current));
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
          <div className="mb-2 hidden items-center gap-1.5 text-xs font-medium text-primary sm:flex"><Sparkles className="size-3.5" />{t("找到合拍的下一局")}</div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("找搭子")}</h1>
          <p className="mt-2 hidden text-sm text-muted-foreground sm:block">{t("推荐池里都是同意被推荐的会员。右滑喜欢，左滑跳过，互相喜欢后才能看到对方的 Riot ID。")}</p>
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
        {loading && (loading.riotId
          ? <LookupProgress label={t("正在查询 {id}…", { id: loading.riotId })} progress={progress} hint={t("第一次查询大约需要 2 分钟，之后会缓存。")} />
          : <LookupProgress label={t("正在从推荐池里准备你的牌堆…")} />)}
        {filter && <DeckFilters filter={filter} onChange={changeFilter} />}
        {error && <Alert variant="error">{t.api(error)}</Alert>}
        {needPicks && <SelfReportForm className="max-w-3xl" player={needPicks} champions={champions}
          onSubmit={async (r) => { try { await saveSelfReport(r); await load(); } catch (e) { setError(e instanceof ApiError ? e.message : String(e)); } }} />}
      </div>

      {cards && (
        <DeckStage remaining={cards} total={total} mutual={mutual} likes={cards.filter((c) => likers.has(c.id))} info={info}
          canUndo={canUndo} onSwipe={onSwipe} onUndo={onUndo} cardActions={safety} paused={!!reporting}
          mutualActions={(c) => <>
            <Button variant="ghost" className={small} onClick={() => act(() => cancelMutualLike(c.id), c.id)}>{t("取消互选")}</Button>
            {safety(c)}
          </>}
          empty={<>
            <p className="font-semibold">{t("暂时没有更多搭子了")}</p>
            <p className="text-sm text-muted-foreground">{t("有新会员加入时会自动出现新的卡片。也可以去查组合，直接算你和某个人的分数。")}</p>
            {filter && isFiltered(filter) && <p className="text-sm text-muted-foreground">{t("你开了筛选，放宽一些会看到更多人。")}</p>}
            <Button variant="outline" asChild><a href="/">{t("去查组合")}</a></Button>
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
