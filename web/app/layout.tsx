import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import Nav from "@/components/Nav";
import { LangProvider } from "@/components/LangProvider";
import { isAdmin } from "@/lib/deckServer";
import { getT } from "@/lib/lang";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

// Latin and digits only; Chinese falls back to the system font (PingFang / Microsoft YaHei)
const display = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-display" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const site = t("英雄联盟匹配搭子");
  return {
    title: { default: `${t("查组合")} · ${site}`, template: `%s · ${site}` },
    description: t("预测两名美服玩家一起打单双排的胜率，并推荐搭子"),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = (await auth())?.user;
  const t = await getT();
  return (
    <html lang={t.lang === "en" ? "en" : "zh-CN"} className={display.variable}>
      <body className="min-h-screen antialiased">
        <LangProvider lang={t.lang}>
        <TooltipProvider delayDuration={150}>
          <main className="mx-auto w-full max-w-[96rem] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8">
            <Nav member={user ? { name: user.name ?? "", admin: await isAdmin(user.id) } : null} />
            {children}
            <footer className="mt-12 space-y-2 text-xs text-muted-foreground" data-testid="footer">
              <p>
                <Link href="/privacy">{t("隐私政策")}</Link><span className="mx-2">·</span><Link href="/terms">{t("服务条款")}</Link>
                <span className="mx-2">·</span>{t("预测算法改编自")} <a href="https://github.com/vigovlugt/draftgap">DraftGap</a> (MIT License)
              </p>
              <p>{t("搭配评分只衡量两个人搭配得合不合适，不是个人实力或隐藏分评分。")}</p>
              {/* Riot's required legal notice (developer.riotgames.com policies), kept in English as Riot words it */}
              <p lang="en">
                LoL Duo Finder (英雄联盟匹配搭子) isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games or
                anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated
                properties are trademarks or registered trademarks of Riot Games, Inc.
              </p>
            </footer>
          </main>
        </TooltipProvider>
        </LangProvider>
      </body>
    </html>
  );
}
