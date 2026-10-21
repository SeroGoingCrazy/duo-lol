import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signInWithDiscord } from "@/app/authActions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getT } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("登录") };
}

export default async function LoginPage() {
  if ((await auth())?.user) redirect("/account");
  const discord = !!process.env.AUTH_DISCORD_ID;
  const t = await getT();
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight lg:text-3xl">{t("登录")}</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        {t("用 Discord 登录，再绑定你的 Riot 账号，就能进入推荐池找搭子。不登录也能用查组合。")}
      </p>
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <Card>
          <CardTitle>{t("Discord 登录")}</CardTitle>
          {discord ? (
            <form action={signInWithDiscord}>
              <Button className="w-full sm:w-auto">{t("用 Discord 登录")}</Button>
            </form>
          ) : (
            <Alert>{t("网站还没配置 Discord 登录：在 web/.env.local 里填 AUTH_DISCORD_ID 和 AUTH_DISCORD_SECRET 后重启。")}</Alert>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {t("我们只读取你的 Discord 用户名，互选后是否给对方看由你决定。")}
          </p>
        </Card>
        {process.env.AUTH_DEV_LOGIN === "1" && (
          <Card data-testid="dev-login">
            <CardTitle>{t("测试登录（只在本地演示时开启）")}</CardTitle>
            <form action="/api/dev-login" method="post" className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <label htmlFor="dev-name" className="text-xs font-medium text-muted-foreground">{t("测试账号名")}</label>
                <Input id="dev-name" name="name" placeholder="tester1" required autoComplete="off" />
              </div>
              <Button variant="outline">{t("以测试账号登录")}</Button>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
