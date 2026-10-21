// 互选通知 in the nav: how many 互选 and 喜欢 are new since this 会员 last opened 找搭子.
import { auth } from "@/auth";
import { unseenCount } from "@/lib/deckServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const id = (await auth())?.user?.id;
  return Response.json({ unseen: id ? await unseenCount(id) : 0 });
}
