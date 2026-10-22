"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutNow } from "@/app/authActions";
import { setLang } from "@/app/langActions";
import { useT } from "@/components/LangProvider";
import { cn } from "@/lib/utils";

const UNSEEN_POLL_MS = 60_000;

export default function Nav({ member }: { member: { name: string; admin?: boolean } | null }) {
  const path = usePathname();
  const t = useT();
  // 互选通知: the layout stays mounted across pages, so ask again on every page change and once a minute
  const [unseen, setUnseen] = useState(0);
  useEffect(() => {
    if (!member) return;
    let live = true;
    const check = () => fetch("/api/notifications", { cache: "no-store" }).then((r) => r.json())
      .then((d) => { if (live) setUnseen(d.unseen ?? 0); }).catch(() => {});
    check();
    const timer = setInterval(check, UNSEEN_POLL_MS);
    return () => { live = false; clearInterval(timer); };
  }, [member?.name, path]);   // eslint-disable-line react-hooks/exhaustive-deps
  const item = (href: string, label: string, badge = 0) => (
    <Link href={href} aria-current={path === href ? "page" : undefined}
      className={cn("rounded-full px-3 py-1.5 text-sm no-underline transition-colors",
        path === href ? "bg-linear-to-r from-neon-a/25 to-neon-b/20 font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}>
      {label}
      {badge > 0 && <span className="ml-1.5 rounded-full bg-good px-1.5 py-0.5 text-[11px] font-semibold text-good-foreground" data-testid="unseen-badge"
        aria-label={t("{n} 条新的互选或喜欢", { n: badge })}>{badge > 99 ? "99+" : badge}</span>}
    </Link>
  );
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1">
      <span className="text-neon mr-3 font-black italic tracking-tight">{t("匹配搭子")}</span>
      {item("/", t("查组合"))}
      {item("/find", t("找搭子"), path === "/find" ? 0 : unseen)}
      <div className="ml-auto flex items-center gap-1">
        {/* both languages always visible, the current one highlighted */}
        <div role="group" aria-label="语言 / Language" className="mr-2 flex rounded-full border p-0.5" data-testid="lang-switch">
          {([["zh", "中文", "zh-CN"], ["en", "English", "en"]] as const).map(([code, label, tag]) => (
            <form key={code} action={setLang.bind(null, code)}>
              <button lang={tag} aria-pressed={t.lang === code} disabled={t.lang === code}
                className={cn("rounded-full px-2.5 py-1 text-xs transition-colors",
                  t.lang === code ? "bg-accent font-semibold text-foreground" : "cursor-pointer text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            </form>
          ))}
        </div>
        {member ? (
          <>
            {member.admin && item("/admin", t("管理"))}
            {item("/account", member.name || t("我的账号"))}
            <form action={signOutNow}>
              <button className="cursor-pointer rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">{t("退出")}</button>
            </form>
          </>
        ) : (
          item("/login", t("登录"))
        )}
      </div>
    </nav>
  );
}
