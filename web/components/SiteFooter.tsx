import Link from "next/link";
import { getT } from "@/lib/lang";

/** Site-wide footer at the bottom of every page: links, the 搭配评分 note, and the copyright line with
 *  Riot's required legal notice (developer.riotgames.com policies), kept in English as Riot words it. */
export default async function SiteFooter() {
  const t = await getT();
  const link = "text-muted-foreground no-underline transition-colors hover:text-foreground";
  return (
    <footer className="mt-auto border-t border-border/60" data-testid="footer">
      <div className="mx-auto grid w-full max-w-[96rem] gap-8 px-4 py-10 text-sm sm:px-6 md:grid-cols-[3fr_1fr] lg:px-10">
        <div className="space-y-2">
          <p className="text-base font-bold tracking-tight"><span className="text-neon">{t("匹配搭子")}</span></p>
          <p className="max-w-md text-muted-foreground">{t("预测两名美服玩家一起打单双排的胜率，并推荐搭子")}</p>
          <p className="max-w-md text-xs text-muted-foreground">{t("搭配评分只衡量两个人搭配得合不合适，不是个人实力或隐藏分评分。")}</p>
        </div>
        <nav aria-label={t("条款")} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">{t("条款")}</p>
          <ul className="space-y-1.5">
            <li><Link href="/privacy" className={link}>{t("隐私政策")}</Link></li>
            <li><Link href="/terms" className={link}>{t("服务条款")}</Link></li>
            <li><a href="https://github.com/vigovlugt/draftgap" className={link}>{t("预测算法改编自")} DraftGap (MIT)</a></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto w-full max-w-[96rem] space-y-2 px-4 py-5 text-xs text-muted-foreground sm:px-6 lg:px-10">
          <p data-testid="copyright">© {new Date().getFullYear()} LoL Duo Finder{t.lang === "zh" && " · 英雄联盟匹配搭子"} · {t("保留所有权利")}</p>
          <p lang="en" className="leading-relaxed text-muted-foreground/80">
            LoL Duo Finder (英雄联盟匹配搭子) isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games or
            anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated
            properties are trademarks or registered trademarks of Riot Games, Inc.
          </p>
        </div>
      </div>
    </footer>
  );
}
