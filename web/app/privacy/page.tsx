import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { getT } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("隐私政策") };
}

const UPDATED = "2026-10-21";

// PRD-v2 §9. Keep in step with what web/lib/db/schema.ts and data/db.py actually store.
export default async function PrivacyPage() {
  if ((await getT()).lang === "en") return <PrivacyEn />;
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
          <li><b>你在网站上的操作</b>：偏好（想打的位置、简介、语言、开麦、常玩时间、是否同意被推荐、自选英雄）、喜欢和跳过、互选、拉黑和举报，以及最近一次登录时间。</li>
        </ul>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">用来做什么</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>预测两名玩家一起双排的胜率，并给你推荐搭子。</li>
          <li>只有双方互相喜欢（互选）后，才向对方显示你的 Riot ID 和你允许显示的 Discord 名。互选前，任何人都看不到你的 Riot ID。</li>
          <li>如果你在偏好里勾选了互选通知，有新的互选时我们的 Discord 机器人会私信你（不含对方的名字）。</li>
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

function PrivacyEn() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Privacy policy</h1>
      <p className="text-muted-foreground">Updated {UPDATED}</p>
      <Card className="space-y-3">
        <h2 className="font-semibold">What we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Discord login</b>: your Discord user ID and username, to log you in. You decide whether matches see the username. We don&apos;t read your email, friends or servers.</li>
          <li><b>Riot account</b>: the Riot ID you link and the account identifier (PUUID) Riot provides.</li>
          <li><b>Match data</b>: public NA Ranked Solo/Duo games read through Riot&apos;s official API (champions, roles, wins, ranks), used to predict win rates and for overall statistics.</li>
          <li><b>What you do here</b>: preferences (roles, bio, languages, voice, play times, whether you want to be recommended, picked champions), likes and passes, matches, blocks and reports, and when you last logged in.</li>
        </ul>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">What we use it for</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Predicting how two players do together in duo, and suggesting partners.</li>
          <li>Your Riot ID, and the Discord name if you allow it, is shown only after you both like each other (a match). Before that, nobody can see your Riot ID.</li>
          <li>If you turn on match notifications in your preferences, our Discord bot DMs you when you get a new match (without the other player&apos;s name).</li>
          <li>Handling reports and preventing abuse.</li>
        </ul>
        <p>We don&apos;t sell data, show ads or share data with third parties, except where the law requires it.</p>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">How long we keep it, and deleting it</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Turning off “Recommend me” takes you out of the pool at once; you won&apos;t appear in anyone&apos;s deck.</li>
          <li>Deleting your account in My account removes your membership, login, preferences, swipes, matches, blocks and reports right away.</li>
          <li>If an admin paused your Riot account after reports, we keep that account identifier after deletion so re-registering can&apos;t undo it.</li>
          <li>Public match data stays part of the overall statistics but is no longer tied to you as a member.</li>
        </ul>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">About the score</h2>
        <p>The duo score only says how well two players fit together. It is not a skill, rank or MMR rating of anyone, and it has nothing to do with Riot Games&apos; ranked system.</p>
      </Card>
      <p className="text-muted-foreground">Questions? Contact the site admin on Discord.</p>
    </article>
  );
}
