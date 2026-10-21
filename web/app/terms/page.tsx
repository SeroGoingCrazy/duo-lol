import type { Metadata } from "next";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "服务条款" };

const UPDATED = "2026-10-21";

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">服务条款</h1>
      <p className="text-muted-foreground">更新于 {UPDATED}</p>
      <Card className="space-y-3">
        <h2 className="font-semibold">这个网站是什么</h2>
        <p>一个帮美服英雄联盟玩家找单双排搭子的工具：根据双方的公开对局预测一起双排的胜率，并在双方都同意后交换 Riot ID。它是免费的非官方粉丝项目，不是 Riot Games 的产品。</p>
        <p>预测胜率和搭配评分是统计估计，只说明两个人搭配得合不合适，不保证输赢，也不是对任何人实力的评价。是否一起排位、选什么英雄由你自己决定。</p>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">使用规则</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>只绑定你自己的 Riot 账号。</li>
          <li>不骚扰、辱骂或威胁其他会员；互选后的联系同样适用。</li>
          <li>不用这个网站代练、买卖账号或做其他违反 Riot Games 服务条款的事。</li>
          <li>不批量抓取网站数据，也不绕过每日喜欢次数等限制。</li>
        </ul>
        <p>违反规则的账号可能被暂停推荐或删除。你可以随时拉黑或举报其他会员，也可以随时注销。</p>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">免责声明</h2>
        <p>网站按现状提供，可能出错或暂停服务。和其他会员的来往由你自己负责，请注意保护个人信息。</p>
      </Card>
    </article>
  );
}
