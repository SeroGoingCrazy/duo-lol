"use client";
import Link from "next/link";
import { ArrowRight, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import { useT } from "@/components/LangProvider";
import { Button } from "@/components/ui/button";

const CAST = ["Jinx", "Vi", "Ekko", "Caitlyn", "Jayce", "Viktor", "Mel"];

export default function HomeHero() {
  const t = useT();
  const features = [
    [Sparkles, t("看位置和英雄熟练度，预测你们一起打单双排的胜率")],
    [HeartHandshake, t("像 Tinder 一样滑卡，双方都喜欢才算互选")],
    [ShieldCheck, t("互选后才交换 Riot ID，Discord 名给不给看由你决定")],
  ] as const;
  return (
    <section className="relative isolate mb-8 overflow-hidden rounded-3xl border bg-card p-6 sm:p-8 lg:p-10" data-testid="home-hero">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-br from-neon-a/10 via-transparent to-neon-b/10" />
      <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="mb-3 text-xs font-semibold text-muted-foreground">{t("美服单双排 · 免费")}</p>
          <h1 className="max-w-2xl text-3xl leading-tight tracking-tight text-balance sm:text-4xl lg:text-5xl">
            {t("找一个")}<span className="text-neon">{t("真正合得来")}</span>{t("的双排搭子")}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">{t("先查你和朋友的搭配评分，或体验滑卡。准备好后，登录、绑定 Riot ID 并同意被推荐，认识真实搭子。")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild><Link href="/find" className="no-underline">{t("开始找搭子")}<ArrowRight /></Link></Button>
            <Button asChild variant="outline"><a href="#duo-check" className="no-underline">{t("和朋友查组合")}</a></Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{t("查组合和演示无需登录；演示中的喜欢与互选均为模拟。")}</p>
        </div>
        <div>
          <ul className="space-y-4">
            {features.map(([Icon, text]) => <li key={text} className="flex items-start gap-3 text-sm"><span className="neon-ring flex size-9 shrink-0 items-center justify-center rounded-xl border bg-card"><Icon className="size-4 text-primary" /></span><span className="pt-1.5">{text}</span></li>)}
          </ul>
          <div className="mt-6 flex -space-x-2" aria-hidden="true">{CAST.map((c) => <img key={c} src={`/champions/${c}.png`} alt="" width={40} height={40} className="size-10 rounded-full border-2 border-background" />)}</div>
        </div>
      </div>
    </section>
  );
}
