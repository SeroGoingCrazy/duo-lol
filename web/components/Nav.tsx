"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutNow } from "@/app/authActions";
import { setLang } from "@/app/langActions";
import { useT } from "@/components/LangProvider";
import { cn } from "@/lib/utils";

export default function Nav({ member }: { member: { name: string; admin?: boolean } | null }) {
  const path = usePathname();
  const t = useT();
  const item = (href: string, label: string) => (
    <Link href={href} aria-current={path === href ? "page" : undefined}
      className={cn("rounded-md px-3 py-1.5 text-sm no-underline transition-colors",
        path === href ? "bg-accent font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}>
      {label}
    </Link>
  );
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1">
      <span className="mr-3 font-bold tracking-tight">{t("匹配搭子")}</span>
      {item("/", t("查组合"))}
      {item("/find", t("找搭子"))}
      <div className="ml-auto flex items-center gap-1">
        <form action={setLang.bind(null, t.lang === "en" ? "zh" : "en")}>
          <button className="cursor-pointer rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            lang={t.lang === "en" ? "zh-CN" : "en"} data-testid="lang-switch">{t.lang === "en" ? "中文" : "English"}</button>
        </form>
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
