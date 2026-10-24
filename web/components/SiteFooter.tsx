import Link from "next/link";
import { getT } from "@/lib/lang";

/** One compact footer block; retain Riot's legal notice in its original English wording. */
export default async function SiteFooter() {
  const t = await getT();
  const link = "text-muted-foreground no-underline transition-colors hover:text-foreground";
  return (
    <footer className="mt-auto border-t border-border/60" data-testid="footer">
      <div className="mx-auto w-full max-w-[96rem] space-y-3 px-4 py-5 text-xs text-muted-foreground sm:px-6 sm:py-6 lg:px-10">
        <nav aria-label={t("条款")}>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            <li><Link href="/privacy" className={link}>{t("隐私政策")}</Link></li>
            <li><Link href="/terms" className={link}>{t("服务条款")}</Link></li>
            <li><a href="https://github.com/vigovlugt/draftgap" className={link}>{t("预测算法改编自")} DraftGap (MIT)</a></li>
          </ul>
        </nav>
        <p className="hidden sm:block">{t("搭配评分只衡量两个人搭配得合不合适，不是个人实力或隐藏分评分。")}</p>
        <p data-testid="copyright">© {new Date().getFullYear()} {t("英雄联盟匹配搭子")} · {t("保留所有权利")}</p>
        <p lang="en" className="leading-relaxed text-muted-foreground/80">
          {t("LoL Duo Finder (英雄联盟匹配搭子) isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.")}
        </p>
      </div>
    </footer>
  );
}
