"use client";
import { useEffect, useState } from "react";
import { useT } from "@/components/LangProvider";
import CopyButton from "@/components/CopyButton";
import { Button } from "@/components/ui/button";
import { getComplementaryPoolCount } from "@/lib/api";

/** Mount only inside an empty 牌堆. Demo results remain separate from this member-pool count. */
export default function EmptyPoolPrompt({ demo = false, refresh = 0 }: { demo?: boolean; refresh?: number }) {
  const t = useT();
  const [pool, setPool] = useState<Awaited<ReturnType<typeof getComplementaryPoolCount>> | null>(null);
  useEffect(() => {
    let active = true;
    getComplementaryPoolCount().then((result) => { if (active) setPool(result); })
      .catch(() => { if (active) setPool(null); }); // A failed count must never look like an empty pool.
    return () => { active = false; };
  }, [refresh]);
  if (!pool) return null;
  return <div className="space-y-2 text-sm" data-testid="empty-pool-prompt">
    {demo && <p className="text-xs text-muted-foreground">{t("以下人数按你在我的账号里设置的想打的位置统计，与演示卡片无关。")}</p>}
    <p>{pool.count > 0
      ? t("推荐池里有 {n} 人想打和你互补的位置", { n: pool.count })
      : t("推荐池里暂时没有想打和你互补位置的会员。邀请朋友加入，或先一起查组合吧。")}</p>
    {pool.count === 0 && <CopyButton text={() => `${window.location.origin}/`} label={t("复制网站链接邀请朋友")} />}
    {!pool.opted_in && <>
      <p className="text-muted-foreground">{t("开启“同意被推荐”，符合推荐条件时你们就能在彼此的牌堆里看到对方。")}</p>
      <Button variant="outline" asChild><a href="/account#recommendation">{t("开启同意被推荐")}</a></Button>
    </>}
  </div>;
}
