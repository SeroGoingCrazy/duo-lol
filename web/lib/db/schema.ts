// The app schema (ADR-0004, PRD-v2 §7): written only by the website. The Python API owns the data schema;
// the two meet only at members.puuid.
import type { DeckFilter } from "@/lib/profile";
import { boolean, index, integer, jsonb, pgSchema, primaryKey, serial, text, timestamp } from "drizzle-orm/pg-core";

export const app = pgSchema("app");

/** 会员. Also Auth.js's users table: name is the Discord username, shown after 互选 if show_discord. */
export const members = app.table("members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  puuid: text("puuid").unique(),            // set by 绑定; one Riot account per 会员
  riotId: text("riot_id"),
  boundAt: timestamp("bound_at", { mode: "date" }),          // 绑定: typed their Riot ID (ADR-0011)
  verifiedAt: timestamp("verified_at", { mode: "date" }),    // Riot proved the account is theirs (old 头像验证, later RSO); null = 未验证
  avatarIconId: integer("avatar_icon_id"),  // 头像: a summoner icon id, their in-game icon until they pick another
  lastActiveAt: timestamp("last_active_at", { mode: "date" }),
  suspendedAt: timestamp("suspended_at", { mode: "date" }),   // out of every 牌堆 until an admin restores them (§8)
  seenAt: timestamp("seen_at", { mode: "date" }),             // last opened 找搭子: 互选 and 喜欢 after this count as new
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
  notifyDiscord: boolean("notify_discord").notNull().default(false),   // 互选通知 by Discord DM, off until ticked
  selfReport: jsonb("self_report").$type<{ tier?: string; picks: { champion: string; position: string }[] }>(),  // 自选英雄 when 数据不足
  // 简介 and the rest of the card's profile (lib/profile.ts); never contact details, those wait for 互选
  bio: text("bio").notNull().default(""),
  languages: text("languages").array().notNull().default([]),
  voice: text("voice", { enum: ["voice", "text"] }),
  playTimes: text("play_times").array().notNull().default([]),
  lookingUntil: timestamp("looking_until", { mode: "date" }),   // 现在想打 until then
  deckFilter: jsonb("deck_filter").$type<DeckFilter>(),         // my own 牌堆 filters
});

const member = (name: string) => text(name).notNull().references(() => members.id, { onDelete: "cascade" });

/** 喜欢 / 跳过: one row per ordered pair; undo deletes the latest 跳过. */
export const swipes = app.table("swipes", {
  fromMember: member("from_member"),
  toMember: member("to_member"),
  action: text("action", { enum: ["like", "pass"] }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.fromMember, t.toMember] }), index("swipes_to_idx").on(t.toMember, t.action)]);

/** 互选: stored once per pair with member_a < member_b. */
export const mutualLikes = app.table("mutual_likes", {
  memberA: member("member_a"),
  memberB: member("member_b"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at", { mode: "date" }),
}, (t) => [primaryKey({ columns: [t.memberA, t.memberB] })]);

/** 拉黑: either direction hides the two from each other for good. */
export const blocks = app.table("blocks", {
  fromMember: member("from_member"),
  toMember: member("to_member"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.fromMember, t.toMember] })]);

/** 举报, handled by an admin: open → dismissed or suspended. */
export const reports = app.table("reports", {
  id: serial("id").primaryKey(),
  fromMember: member("from_member"),
  toMember: member("to_member"),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["open", "dismissed", "suspended"] }).notNull().default("open"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  handledAt: timestamp("handled_at", { mode: "date" }),
}, (t) => [index("reports_to_idx").on(t.toMember)]);

/** Riot accounts an admin (or the 3-report rule) paused. Kept after 注销 so re-registering doesn't clear it;
 *  binding the same Riot account again starts paused. */
export const riotBans = app.table("riot_bans", {
  puuid: text("puuid").primaryKey(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
