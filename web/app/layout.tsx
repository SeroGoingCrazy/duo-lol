import type { Metadata } from "next";
import { auth } from "@/auth";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import { LangProvider } from "@/components/LangProvider";
import { isAdmin } from "@/lib/deckServer";
import { getT } from "@/lib/lang";
import { memberAvatar } from "@/lib/profileIcons";
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
          <div className="flex min-h-screen flex-col overflow-x-clip">
            <main className="mx-auto w-full max-w-[96rem] flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8">
              <Nav member={user ? { name: user.name ?? "", admin: await isAdmin(user.id), avatar: await memberAvatar(user.id) } : null} />
              {children}
            </main>
            <SiteFooter />
          </div>
        </TooltipProvider>
        </LangProvider>
      </body>
    </html>
  );
}
