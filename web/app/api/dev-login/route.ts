// Local demo and end-to-end tests only (AUTH_DEV_LOGIN=1): log in as a named test 会员 without Discord.
// Off unless that variable is set, so a deployed site never has it.
import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb, schema } from "@/lib/db";

const SESSION_DAYS = 30;   // Auth.js's default session length

// relative, so the browser stays on the host it used (req.url can name a different one behind next start)
const to = (path: string) => new NextResponse(null, { status: 303, headers: { Location: path } });

export async function POST(req: NextRequest) {
  if (process.env.AUTH_DEV_LOGIN !== "1") return new NextResponse(null, { status: 404 });
  const name = String((await req.formData()).get("name") ?? "").trim();
  if (!name) return to("/login");

  const db = await getDb();
  const [linked] = await db.select({ id: schema.authAccounts.userId }).from(schema.authAccounts)
    .where(and(eq(schema.authAccounts.provider, "dev"), eq(schema.authAccounts.providerAccountId, name)));
  let id = linked?.id;
  if (!id) {
    [{ id }] = await db.insert(schema.members).values({ name }).returning({ id: schema.members.id });
    await db.insert(schema.authAccounts).values({ userId: id, type: "oauth", provider: "dev", providerAccountId: name });
  }
  const sessionToken = crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(schema.authSessions).values({ sessionToken, userId: id, expires });

  const res = to("/account");
  const secure = req.nextUrl.protocol === "https:";
  res.cookies.set(secure ? "__Secure-authjs.session-token" : "authjs.session-token", sessionToken,
    { httpOnly: true, sameSite: "lax", path: "/", secure, expires });
  return res;
}
