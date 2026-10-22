import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { signInWithDiscord } from "@/app/authActions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getT } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("登录") };
}

// Arcane's cast, from the vendored champion portraits
const CAST = ["Jinx", "Vi", "Ekko", "Caitlyn", "Jayce", "Viktor", "Mel"];
// a stronger pool of the Arcane neons behind the hero than the site background has
const GLOW = "radial-gradient(40rem 24rem at 10% 20%, color-mix(in srgb, var(--neon-a) 16%, transparent), transparent 70%), radial-gradient(36rem 22rem at 90% 80%, color-mix(in srgb, var(--neon-b) 14%, transparent), transparent 70%)";

function DiscordLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.6 1.25a18.3 18.3 0 0 0-5.49 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04 19.7 19.7 0 0 0-4.89 1.52.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 0 0-.04-.1 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01c3.93 1.8 8.18 1.8 12.07 0a.07.07 0 0 1 .08.01l.37.29a.08.08 0 0 1-.01.13c-.6.35-1.22.65-1.87.9a.08.08 0 0 0-.04.1c.36.7.77 1.37 1.23 2a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6-3.03.08.08 0 0 0 .03-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.15-1.09-2.15-2.42s.95-2.42 2.15-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42Z" />
    </svg>
  );
}

export default async function LoginPage() {
  if ((await auth())?.user) redirect("/account");
  const discord = !!process.env.AUTH_DISCORD_ID;
  const t = await getT();
  const features = [
    [Sparkles, t("看位置和英雄熟练度，预测你们一起打单双排的胜率")],
    [HeartHandshake, t("像 Tinder 一样滑卡，双方都喜欢才算互选")],
    [ShieldCheck, t("互选后才交换 Riot ID，Discord 名给不给看由你决定")],
  ] as const;
  const steps = [t("用 Discord 登录"), t("输入你的 Riot ID 绑定账号"), t("打开「同意被推荐」，开始找搭子")];

  return (
    <div className="relative isolate py-6 lg:py-14">
      <div aria-hidden="true" className="pointer-events-none absolute -inset-x-40 -inset-y-20 -z-10" style={{ background: GLOW }} />
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <section>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-good" />{t("美服单双排 · 免费")}
          </p>
          <h1 className="text-4xl leading-tight tracking-tight text-balance lg:text-5xl">
            {t("找一个")}<span className="text-neon">{t("真正合得来")}</span>{t("的双排搭子")}
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            {t("用 Discord 登录，再绑定你的 Riot 账号，就能进入推荐池找搭子。不登录也能用查组合。")}
          </p>
          <ul className="mt-8 space-y-4">
            {features.map(([Icon, text]) => (
              <li key={text} className="flex items-start gap-3">
                <span className="glass neon-ring inline-flex size-9 shrink-0 items-center justify-center rounded-xl border bg-card">
                  <Icon className="size-4.5 text-primary" />
                </span>
                <span className="pt-1.5 text-sm">{text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex items-center gap-4">
            <div className="flex -space-x-3">
              {CAST.map((c) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={c} src={`/champions/${c}.png`} alt="" width={44} height={44}
                  className="size-11 rounded-full border-2 border-background object-cover shadow-md" />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t("皮城和祖安的英雄都在等搭子")}</p>
          </div>
        </section>

        <Card className="p-6 lg:p-8" data-testid="login-card">
          <h2 className="text-2xl font-bold tracking-tight">{t("登录 / 注册")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("第一次用 Discord 登录就会自动注册。")}</p>
          <div className="mt-6">
            {discord ? (
              <form action={signInWithDiscord}>
                <Button className="h-12 w-full bg-none text-base bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/30 hover:bg-[#4752c4]">
                  <DiscordLogo />{t("用 Discord 登录")}
                </Button>
              </form>
            ) : (
              <Alert>{t("网站还没配置 Discord 登录：在 web/.env.local 里填 AUTH_DISCORD_ID 和 AUTH_DISCORD_SECRET 后重启。")}</Alert>
            )}
          </div>
          <ol className="mt-6 space-y-3">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span className="bg-neon inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs text-muted-foreground">
            {t("我们只读取你的 Discord 用户名，互选后是否给对方看由你决定。")}{" "}
            <Link href="/privacy">{t("隐私政策")}</Link>
          </p>
          <Link href="/" className="mt-6 flex items-center justify-between rounded-xl border px-4 py-3 text-sm no-underline transition-colors hover:bg-accent">
            <span><span className="font-medium text-foreground">{t("不登录也能用查组合")}</span>
              <span className="block text-xs text-muted-foreground">{t("输入两个 Riot ID，看你们一起打的搭配评分")}</span></span>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Link>
          {process.env.AUTH_DEV_LOGIN === "1" && (
            <div className="mt-6 border-t pt-5" data-testid="dev-login">
              <p className="mb-3 text-xs font-semibold text-muted-foreground">{t("测试登录（只在本地演示时开启）")}</p>
              <form action="/api/dev-login" method="post" className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <label htmlFor="dev-name" className="text-xs font-medium text-muted-foreground">{t("测试账号名")}</label>
                  <Input id="dev-name" name="name" placeholder="tester1" required autoComplete="off" />
                </div>
                <Button variant="outline">{t("以测试账号登录")}</Button>
              </form>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
