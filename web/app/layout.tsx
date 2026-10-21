import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import Nav from "@/components/Nav";
import { isAdmin } from "@/lib/deckServer";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "查组合 · 英雄联盟匹配搭子", template: "%s · 英雄联盟匹配搭子" },
  description: "预测两名美服玩家一起打单双排的胜率，并推荐搭子",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = (await auth())?.user;
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">
        <TooltipProvider delayDuration={150}>
          <main className="mx-auto w-full max-w-[96rem] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8">
            <Nav member={user ? { name: user.name ?? "", admin: await isAdmin(user.id) } : null} />
            {children}
            <footer className="mt-12 space-y-2 text-xs text-muted-foreground" data-testid="footer">
              <p>
                <Link href="/privacy">隐私政策</Link><span className="mx-2">·</span><Link href="/terms">服务条款</Link>
                <span className="mx-2">·</span>预测算法改编自 <a href="https://github.com/vigovlugt/draftgap">DraftGap</a>（MIT License）
              </p>
              <p>搭配评分只衡量两个人搭配得合不合适，不是个人实力或隐藏分评分。</p>
              {/* Riot's required legal notice (developer.riotgames.com policies), kept in English as Riot words it */}
              <p lang="en">
                英雄联盟匹配搭子 isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games or
                anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated
                properties are trademarks or registered trademarks of Riot Games, Inc.
              </p>
            </footer>
          </main>
        </TooltipProvider>
      </body>
    </html>
  );
}
