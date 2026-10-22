"use client";
// 头像: a summoner icon, the one worn in game until the 会员 picks another from Riot's icons.
import { useActionState, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Search, UserRound } from "lucide-react";
import { setAvatar } from "@/app/account/actions";
import { Feedback, NONE } from "@/components/AccountForms";
import { useT } from "@/components/LangProvider";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { profileIconUrl, type ProfileIconList } from "@/lib/profileIconUrl";
import { cn } from "@/lib/utils";

const PAGE = 96;

/** A round summoner icon, or a plain silhouette before there is one. */
export function Avatar({ url, size = 40, className }: { url: string | null; size?: number; className?: string }) {
  const t = useT();
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={t("头像")} width={size} height={size} data-testid="avatar"
      className={cn("shrink-0 rounded-full border bg-muted object-cover", className)} style={{ width: size, height: size }} />
  ) : (
    <span data-testid="avatar" className={cn("inline-flex shrink-0 items-center justify-center rounded-full border bg-muted text-muted-foreground", className)}
      style={{ width: size, height: size }}><UserRound style={{ width: size * 0.55, height: size * 0.55 }} /></span>
  );
}

export function AvatarCard({ current, currentUrl, bound }: { current: number | null; currentUrl: string | null; bound: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<ProfileIconList | null>(null);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [picked, setPicked] = useState<number | null>(null);
  const [saved, save, saving] = useActionState(async (s: typeof NONE, form: FormData) => {
    const r = await setAvatar(s, form);
    if (r.ok) { setOpen(false); setPicked(null); }
    return r;
  }, NONE);

  useEffect(() => {
    if (!open || list) return;
    fetch("/profileicons/icons.json").then((r) => r.json()).then(setList).catch(() => {});
  }, [open, list]);

  // search the Chinese and English titles and the id, so "金克丝", "jinx" and "4895" all work
  const q = useDeferredValue(query.trim().toLowerCase());
  const matches = useMemo(() => !list ? [] : !q ? list.icons
    : list.icons.filter(([id, zh, en, year]) => zh.toLowerCase().includes(q) || en.toLowerCase().includes(q) || String(id) === q || String(year) === q)
      .sort((a, b) => Number(String(b[0]) === q) - Number(String(a[0]) === q)), [list, q]);   // an exact id first
  useEffect(() => setShown(PAGE), [q]);
  const title = (id: number) => {
    const icon = list?.icons.find(([i]) => i === id);
    return icon ? (t.lang === "en" ? icon[2] : icon[1]) || `#${id}` : `#${id}`;
  };

  return (
    <Card data-testid="avatar-card">
      <CardTitle>{t("头像")}</CardTitle>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar url={picked != null && list ? profileIconUrl(list.version, picked) : currentUrl} size={72} />
        <div className="min-w-0 flex-1 text-sm">
          <p className="text-muted-foreground">
            {current == null ? t("绑定 Riot 账号后会自动用你游戏里的召唤师头像，也可以从 Riot 的头像里另选一个。")
              : t("别人在互选列表里看到的就是这个头像。")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? t("收起") : t("从 Riot 头像里选")}
            </Button>
            {bound && (
              <form action={save}><input type="hidden" name="icon" value="game" />
                <Button variant="ghost" size="sm" disabled={saving}>{t("用我游戏里的头像")}</Button></form>
            )}
          </div>
        </div>
      </div>
      {open && (
        <div className="mt-4" data-testid="icon-picker">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label={t("搜索头像")} placeholder={t("搜索头像，比如 金克丝、Arcane、2025")} value={query}
              onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          {!list ? <p className="text-sm text-muted-foreground">{t("加载中…")}</p> : matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("没有找到这个头像")}</p>
          ) : (
            <>
              <div role="radiogroup" aria-label={t("Riot 头像")}
                className="grid max-h-80 grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-2 overflow-y-auto pr-1">
                {matches.slice(0, shown).map(([id, zh, en]) => {
                  const on = (picked ?? current) === id;
                  return (
                    <button key={id} type="button" role="radio" aria-checked={on} title={(t.lang === "en" ? en : zh) || `#${id}`}
                      aria-label={(t.lang === "en" ? en : zh) || `#${id}`} onClick={() => setPicked(id)}
                      className={cn("aspect-square cursor-pointer overflow-hidden rounded-lg border-2 transition",
                        on ? "border-primary ring-2 ring-primary/40" : "border-transparent hover:border-border")}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={profileIconUrl(list.version, id)} alt="" loading="lazy" className="size-full bg-muted object-cover" />
                    </button>
                  );
                })}
              </div>
              {matches.length > shown && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShown((n) => n + PAGE)}>
                  {t("再显示 {n} 个（共 {total} 个）", { n: Math.min(PAGE, matches.length - shown), total: matches.length })}
                </Button>
              )}
            </>
          )}
          <form action={save} className="mt-3 flex flex-wrap items-center gap-3">
            <input type="hidden" name="icon" value={picked ?? ""} />
            <Button disabled={saving || picked == null || picked === current}>{saving ? t("保存中…") : t("用这个头像")}</Button>
            {picked != null && <span className="text-sm text-muted-foreground" data-testid="picked-icon">{title(picked)}</span>}
          </form>
        </div>
      )}
      <Feedback state={saved} />
    </Card>
  );
}
