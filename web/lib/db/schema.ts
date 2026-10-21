// The app schema (ADR-0004, PRD-v2 §7): written only by the website. The Python API owns the data schema;
// the two meet only at members.puuid.
import { boolean, integer, pgSchema, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const app = pgSchema("app");

/** 会员. Also Auth.js's users table: name is the Discord username, shown after 互选 if show_discord. */
export const members = app.table("members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  puuid: text("puuid").unique(),            // set once 头像验证 passes; one Riot account per 会员
  riotId: text("riot_id"),
  verifiedAt: timestamp("verified_at", { mode: "date" }),
  lastActiveAt: timestamp("last_active_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const authAccounts = app.table("auth_accounts", {
  userId: text("user_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]);

export const authSessions = app.table("auth_sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const memberPrefs = app.table("member_prefs", {
  memberId: text("member_id").primaryKey().references(() => members.id, { onDelete: "cascade" }),
  positions: text("positions").array().notNull().default([]),          // 想打的位置, at most 2
  recommendOptIn: boolean("recommend_opt_in").notNull().default(false), // 同意被推荐: off until ticked
  showDiscord: boolean("show_discord").notNull().default(false),
});

/** 头像验证 in progress: the icon this 会员 was asked to wear on riot_id. */
export const verificationChallenges = app.table("verification_challenges", {
  memberId: text("member_id").primaryKey().references(() => members.id, { onDelete: "cascade" }),
  puuid: text("puuid").notNull(),
  riotId: text("riot_id").notNull(),
  iconId: integer("icon_id").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
});
