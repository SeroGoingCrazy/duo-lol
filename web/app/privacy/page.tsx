import type { Metadata } from "next";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "隐私政策" };

const UPDATED = "2026-10-21";

// PRD-v2 §9. Keep in step with what web/lib/db/schema.ts and data/db.py actually store.
export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">隐私政策</h1>
      <p className="text-muted-foreground">更新于 {UPDATED}</p>
      <Card className="space-y-3">
        <h2 className="font-semibold">我们收集什么</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Discord 登录</b>：你的 Discord 用户 ID 和用户名，用来登录；互选后是否给对方看用户名由你决定。我们不读取你的邮箱、好友或服务器。</li>
          <li><b>Riot 账号</b>：你绑定的 Riot ID 和 Riot 提供的账号标识（PUUID）。</li>
          <li><b>对局数据</b>：通过 Riot 官方 API 读取的美服单双排公开对局（英雄、位置、胜负、段位），用于计算预测胜率和全服统计。</li>
          <li><b>你在网站上的操作</b>：偏好（想打的位置、是否同意被推荐、自选英雄）、喜欢和跳过、互选、拉黑和举报，以及最近一次登录时间。</li>
        </ul>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">用来做什么</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>预测两名玩家一起双排的胜率，并给你推荐搭子。</li>
          <li>只有双方互相喜欢（互选）后，才向对方显示你的 Riot ID 和你允许显示的 Discord 名。互选前，任何人都看不到你的 Riot ID。</li>
          <li>处理举报、防止滥用。</li>
        </ul>
        <p>我们不出售数据，不投放广告，也不把数据交给第三方，法律要求的情况除外。</p>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">保存多久、怎么删除</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>关闭“同意被推荐”后，你立刻退出推荐池，不会再出现在任何人的牌堆里。</li>
          <li>在“我的账号”里注销后，我们立刻删除你的会员资料、登录信息、偏好、滑卡、互选、拉黑和举报记录。</li>
          <li>如果你的 Riot 账号因举报被管理员暂停，注销后我们仍保留这个账号标识，防止重新注册绕过处理。</li>
          <li>公开对局数据作为全服统计的一部分保留，但不再和你的会员身份关联。</li>
        </ul>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">关于评分</h2>
        <p>搭配评分只说明两名玩家搭配得合不合适，不是任何一个人的实力、段位或隐藏分（MMR）评分，也不代表 Riot Games 的排位系统。</p>
      </Card>
      <p className="text-muted-foreground">有问题请在 Discord 联系网站管理员。</p>
    </article>
  );
}
