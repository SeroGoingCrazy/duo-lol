import type { Metadata } from "next";
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
            <footer className="mt-12 text-xs text-muted-foreground">
              非 Riot Games 官方产品，与 Riot Games 无关。预测算法改编自{" "}
              <a href="https://github.com/vigovlugt/draftgap">DraftGap</a>（MIT License）。
            </footer>
          </main>
        </TooltipProvider>
      </body>
    </html>
  );
}
