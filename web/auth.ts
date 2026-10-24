// 登录 (PRD-v2 §3.1, ADR-0005): Discord through Auth.js, sessions stored in app.auth_sessions.
import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

const ACTIVE_EVERY_MS = 60 * 60 * 1000;   // last_active_at feeds the 14-day 推荐池 rule; hourly is precise enough

export const { handlers: { GET, POST }, auth, signIn, signOut } = NextAuth(async () => {
  const db = await getDb();
  return {
    adapter: DrizzleAdapter(db, {
      usersTable: schema.members,
      accountsTable: schema.authAccounts,
      sessionsTable: schema.authSessions,
    }),
    providers: [
      // name is the Discord username, the handle other players add as a friend after 互选
      // scope "identify" only: no email, guilds or friends (see the privacy page)
      // issuer: Discord now sends iss on the callback, and Auth.js rejects it unless it matches
      Discord({ issuer: "https://discord.com", authorization:{ params: { scope: "identify" } }, profile: (p) => ({ id: p.id, name: p.username, email: null, image: null }) }),
    ],
    session: { strategy: "database" },
    trustHost: true,
    pages: { signIn: "/login" },
    callbacks: {
      async session({ session, user }) {
        const member = user as typeof schema.members.$inferSelect;
        if (!member.lastActiveAt || Date.now() - member.lastActiveAt.getTime() > ACTIVE_EVERY_MS) {
          await db.update(schema.members).set({ lastActiveAt: new Date() }).where(eq(schema.members.id, member.id));
        }
        return { ...session, user: { ...session.user, id: member.id } };
      },
    },
  };
});
