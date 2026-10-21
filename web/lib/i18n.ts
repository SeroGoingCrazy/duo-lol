// Two languages: 中文 (the source text, also the lookup key) and English for NA players.
// Code keeps writing the Chinese phrase (CONTEXT.md terms) and wraps it in t(); English comes from EN below,
// falling back to the Chinese when a phrase has no entry. {name} placeholders are filled from vars.
import { POSITION_LABELS, TIER_LABELS } from "@/lib/labels";

export type Lang = "zh" | "en";
export const LANGS: Lang[] = ["zh", "en"];
export const LANG_COOKIE = "lang";

/** First match in Accept-Language: Chinese for zh*, English for everything else (the site serves NA). */
export function pickLang(cookie: string | undefined, acceptLanguage: string | null): Lang {
  if (cookie === "zh" || cookie === "en") return cookie;
  const first = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("zh") ? "zh" : "en";
}

const EN = new Map<string, string>(Object.entries({
  // nav, layout, footer
  "匹配搭子": "Duo Finder",
  "查组合": "Duo check",
  "找搭子": "Find a duo",
  "登录": "Log in",
  "退出": "Log out",
  "我的账号": "My account",
  "管理": "Admin",
  "隐私政策": "Privacy",
  "服务条款": "Terms",
  "预测算法改编自": "Prediction adapted from",
  "搭配评分只衡量两个人搭配得合不合适，不是个人实力或隐藏分评分。": "The duo score only measures how well two players fit together. It is not a skill, rank or MMR rating of anyone.",
  "预测两名美服玩家一起打单双排的胜率，并推荐搭子": "Predict how two NA players do together in Ranked Solo/Duo, and find a duo partner",

  // 查组合
  "输入两个美服 Riot ID，看你们一起打单双排的搭配评分和最佳英雄组合。": "Enter two NA Riot IDs to see your duo score and best champion pairs for Ranked Solo/Duo.",
  "玩家 A": "Player A",
  "玩家 B": "Player B",
  "两个 Riot ID 是同一个人，请填另一位玩家": "Both Riot IDs are the same player; enter someone else",
  "预测": "Predict",
  "第一次查询的玩家大约需要 2 分钟，之后会缓存。": "A player's first lookup takes about 2 minutes; after that it's cached.",
  "第一次查询大约需要 2 分钟，之后会缓存。": "The first lookup takes about 2 minutes; after that it's cached.",
  "正在读取 {id} 本赛季的单双排对局…": "Reading {id}'s Solo/Duo games this season…",
  "正在计算搭配评分…": "Working out the duo score…",
  "第 {n} / {total} 位玩家": "Player {n} of {total}",
  "修改自选英雄": "Change picked champions",
  "搭配评分": "Duo score",
  "预测胜率": "Predicted win rate",
  "比你们单排平均高 {pts}": "{pts} above your solo average",
  "比你们单排平均低 {pts}": "{pts} below your solo average",
  "单排基线：{a} {pa}，{b} {pb}": "Solo baselines: {a} {pa}, {b} {pb}",
  "建议位置和最佳英雄组合": "Suggested roles and best champion pairs",
  "全服 {n} 局": "{n} games",
  "本赛季 {n} 场": "{n} games this season",
  "数据不足，按自选英雄": "Few games, using picked champions",
  "常用英雄": "Most played",
  "{champ} · {n} 场 {wr}% 胜率": "{champ} · {n} games, {wr}% win rate",
  "评分校准中": "Calibrating",
  "分": "pts",
  "评分怎么算": "How the score works",
  "比 {n}% 的组合更好": "Better than {n}% of pairs",
  "只比 {n}% 的组合好": "Better than only {n}% of pairs",
  "按位置筛选": "Filter by role",
  "全部": "All",
  "比 {n}% 的{roles}组合更好": "Better than {n}% of {roles} pairs",
  "只比 {n}% 的{roles}组合好": "Better than only {n}% of {roles} pairs",
  "双排的预测胜率大多集中在 50% 附近，差 1% 已经很明显。评分把预测胜率放进推荐池里同样两个位置、可双排的组合的胜率分布（按正态分布）里看排第几：":
    "Predicted duo win rates cluster around 50%, so 1% is already a lot. The score ranks this pair's predicted win rate among pairs in the pool who can queue together in the same two roles (a normal fit):",
  "50 分是普通水平，84 分比 84% 的组合好，高于 50 分就算不错。": "50 is an average pair, 84 beats 84% of pairs, and anything above 50 is good.",
  "评分只说明这两个人搭配得合不合适，不是任何一个人的实力、段位或隐藏分。": "It only says how well these two fit together. It is not anyone's skill, rank or MMR.",
  "复制 {id}": "Copy {id}",
  "已复制": "Copied",
  "复制 ID": "Copy ID",
  "格式是 名字#标签，例如 Name#NA1": "Use name#tag, for example Name#NA1",
  "复制分享链接": "Copy share link",

  // 互选通知 and 一起打的战绩
  "本赛季一起打了 {n} 局，赢 {w} 局": "{n} games together this season, {w} won",
  "还没一起打过单双排": "No Solo/Duo games together yet",
  "{n} 条新的互选或喜欢": "{n} new matches or likes",
  "有新的互选时用 Discord 私信通知我": "DM me on Discord when I get a new match",
  "需要先加入网站的 Discord 服务器，机器人才能私信你。网站导航上也会显示新的互选和喜欢。": "Join the site's Discord server first so the bot can DM you. New matches and likes also show in the site's menu.",

  // 玩家资料页
  "玩家资料": "Player",
  "胜率 {wr}": "{wr} win rate",
  "数据不足": "Few games",
  "{n} 场": "{n} games",
  "和 TA 查组合": "Check your duo with them",
  "最近对局": "Recent games",
  "本赛季还没有单双排对局。": "No Solo/Duo games this season yet.",
  "{m} 分钟": "{m} min",
  "胜": "Win",
  "负": "Loss",

  // 自选英雄
  "{id} 本赛季单双排只有 {n} 场": "{id} has only {n} Solo/Duo games this season",
  "不到 20 场，没法用战绩预测。选几个常玩的英雄（最多 {picks} 个、{roles} 个位置），我们按这些英雄在{tier}的全服胜率来估算。":
    "Under 20 games is too few to predict from. Pick a few champions you play (up to {picks}, in up to {roles} roles) and we'll estimate from their win rates in {tier}.",
  "你所选段位": "the tier you pick",
  "本赛季还没定级，选一个接近的段位": "Not ranked this season yet: pick a tier close to yours",
  "段位": "Tier",
  "选择段位": "Choose a tier",
  "请选择段位": "Choose a tier",
  "请选择英雄": "Choose a champion",
  "请选择位置": "Choose a role",
  "英雄 {n}": "Champion {n}",
  "位置 {n}": "Role {n}",
  "位置": "Role",
  "删除第 {n} 个": "Remove #{n}",
  "第 {n} 行：{err}": "Row {n}: {err}",
  "最多 {n} 个位置，现在选了 {roles}": "At most {n} roles; you picked {roles}",
  "再加一个": "Add another",
  "用这些英雄估算": "Estimate with these",
  "搜索英雄（中文或英文）": "Search champions",
  "{label} 搜索": "Search {label}",
  "没有这个英雄": "No such champion",

  // 找搭子 deck
  "找到合拍的下一局": "Find the teammate who fits",
  "看看搭配，选个队友。右滑喜欢，左滑跳过。": "See how you'd fit, pick a teammate. Swipe right to like, left to pass.",
  "推荐池里都是同意被推荐的会员。右滑喜欢，左滑跳过，互相喜欢后才能看到对方的 Riot ID。": "Everyone here opted in to be recommended. Swipe right to like, left to pass; Riot IDs show only after you both like each other.",
  "美服 · 单双排": "NA · Solo/Duo",
  "演示版": "Demo",
  "当前玩家": "Player",
  "更换玩家": "Change",
  "从你的 Riot ID 开始": "Start from your Riot ID",
  "你的 Riot ID": "Your Riot ID",
  "开始滑卡": "Start swiping",
  "正在从推荐池里准备你的牌堆…": "Building your deck from the pool…",
  "推荐池里暂时没有能和你一起排的玩家。": "Nobody in the pool can queue with you right now.",
  "暂时没有更多搭子了": "No more players for now",
  "推荐池有新玩家时会出现新的卡片。也可以去查组合，直接算你和某个人的分数。": "New cards appear as players join. You can also use Duo check to score you and someone specific.",
  "有新会员加入时会自动出现新的卡片。也可以去查组合，直接算你和某个人的分数。": "New cards appear on their own as members join. You can also use Duo check to score you and someone specific.",
  "去查组合": "Go to Duo check",
  "重新开始": "Start over",
  "演示版：滑卡记录只存在这个浏览器里；搭配评分 50 以上的玩家视为也喜欢了你。": "Demo: swipes stay in this browser, and players with a duo score of 50 or more count as liking you back.",
  "这是演示版：牌堆来自已收录的玩家，对方的喜欢是模拟的。": "This is a demo: the deck comes from players we've collected, and their likes are simulated. ",
  "并绑定 Riot 账号后，就能和真实会员互滑。": " and link your Riot account to swipe real members.",
  "这是演示版。": "This is a demo. ",
  "你的账号因被举报暂停推荐，等待管理员处理。": "Your account is paused from recommendations after reports, pending an admin.",
  "先在我的账号里绑定 Riot 账号，": "Link your Riot account in My account first, ",
  "先在我的账号里开启“同意被推荐”，": "Turn on “Recommend me” in My account first, ",
  "去我的账号": "go to My account",
  "，完成后就能和真实会员互滑。": ", then you can swipe real members.",
  "今天还能喜欢 {n} 次": "{n} likes left today",
  "为你推荐": "For you",
  "按预测胜率排序": "best predicted win rate first",
  "剩余 {n} / {total}": "{n} / {total} left",
  "撤销上一次跳过": "Undo last pass",
  "撤销": "Undo",
  "跳过": "Pass",
  "喜欢": "Like",
  "左滑跳过": "Swipe left to pass",
  "右滑喜欢": "swipe right to like",
  "，也可使用方向键": ", or use the arrow keys",
  "互选成功": "It's a match",
  "你们互相喜欢了。在游戏客户端里加对方好友，一起排位吧。": "You liked each other. Add each other in the League client and queue up.",
  "Discord：{name}": "Discord: {name}",
  "继续滑": "Keep swiping",
  "拉黑": "Block",
  "举报": "Report",
  "取消互选": "Unmatch",
  "举报 {who}": "Report {who}",
  "这名会员": "this member",
  "举报会同时拉黑对方，管理员会人工处理。对方不会知道是谁举报的。": "Reporting also blocks them. An admin reviews it, and they won't know who reported.",
  "理由": "Reason",
  "骚扰或辱骂": "Harassment or abuse",
  "冒用他人账号": "Using someone else's account",
  "代练或买卖账号": "Boosting or account trading",
  "其他": "Other",
  "补充说明（可选）": "Details (optional)",
  "取消": "Cancel",
  "提交举报": "Submit report",
  "你的搭子": "Your duos",
  "互选": "Matches",
  "喜欢我的人": "Likes you",
  "下一位搭子，等你发现": "Your next duo is out there",
  "遇到合适的玩家就右滑喜欢。": "Swipe right on players who fit.",
  "互选后，在这里找到 TA 的 Riot ID。": "After a match, their Riot ID shows up here.",
  "暂时没有新的人喜欢你。": "No new likes yet.",
  "{tier} 玩家": "{tier} player",
  "点开看卡片，右滑就互选": "Open the card; like it to match",

  // 卡片
  "英雄组合": "Champion pairs",
  "推荐给你的搭子": "Suggested duo",
  "{role}玩家": "{role} player",
  "喜欢了你": "Likes you",
  "卡片详情": "Card pages",
  "比单排基线平均高": "Above your solo baselines by",
  "比单排基线平均低": "Below your solo baselines by",
  "你": "You",
  "TA": "Them",
  "你打": "You play",
  "TA 打": "They play",
  "你打{a}，TA 打{b}": "You play {a}, they play {b}",
  "试试这个英雄组合": "Try this champion pair",
  "查看全部": "See all",
  "为什么推荐 TA": "Why them",
  "根据位置分配与英雄组合给出的推荐理由": "Reasons from the role split and champion pairs",
  "互选后解锁 Riot ID": "Riot ID unlocks after a match",
  "点左右翻页 {n} / {total}": "Tap left or right to flip {n} / {total}",

  // 登录 and 我的账号
  "用 Discord 登录，再绑定你的 Riot 账号，就能进入推荐池找搭子。不登录也能用查组合。": "Log in with Discord and link your Riot account to join the pool and find a duo. Duo check works without logging in.",
  "Discord 登录": "Discord login",
  "用 Discord 登录": "Log in with Discord",
  "网站还没配置 Discord 登录：在 web/.env.local 里填 AUTH_DISCORD_ID 和 AUTH_DISCORD_SECRET 后重启。": "Discord login isn't set up: fill AUTH_DISCORD_ID and AUTH_DISCORD_SECRET in web/.env.local and restart.",
  "我们只读取你的 Discord 用户名，互选后是否给对方看由你决定。": "We only read your Discord username, and you decide whether matches see it.",
  "测试登录（只在本地演示时开启）": "Test login (local demos only)",
  "测试账号名": "Test account name",
  "以测试账号登录": "Log in as test account",
  "Discord：": "Discord: ",
  "Riot 账号": "Riot account",
  "已验证": "Verified",
  "验证 {id}": "Verify {id}",
  "召唤师头像 #{n}": "Summoner icon #{n}",
  "在游戏客户端里把召唤师头像换成这个（": "In the League client, switch your summoner icon to this one (",
  "，所有账号都有），换好后点验证。": ", every account owns it), then press Verify.",
  "10 分钟内有效。验证成功后可以换回原来的头像。": "Valid for 10 minutes. You can switch back once verified.",
  "验证中…": "Verifying…",
  "验证": "Verify",
  "换一个 Riot ID": "Use another Riot ID",
  "绑定 Riot 账号": "Link your Riot account",
  "查询中…": "Looking up…",
  "下一步": "Next",
  "只能绑定美服账号。为了确认账号是你的，下一步会请你换一个指定的召唤师头像。": "NA accounts only. To prove it's yours, the next step asks you to wear a specific summoner icon.",
  "偏好": "Preferences",
  "绑定 Riot 账号后才能设置偏好、进入推荐池。": "Link your Riot account to set preferences and join the pool.",
  "想打的位置（最多 2 个）": "Roles you want to play (up to 2)",
  "同意被推荐": "Recommend me",
  "勾选后你会出现在别人的牌堆里；随时可以关掉，关掉后立刻退出推荐池。": "Others will see you in their deck. Turn it off any time to leave the pool at once.",
  "互选后给对方看我的 Discord 名（{name}）": "Show my Discord name ({name}) to matches",
  "不勾选的话，对方只看到你的 Riot ID。": "If off, matches only see your Riot ID.",
  "保存中…": "Saving…",
  "保存": "Save",
  "注销账号": "Delete account",
  "删除你的会员资料、绑定和偏好，不能恢复。查组合缓存的公开对局数据不受影响。": "Deletes your membership, link and preferences for good. Public match data cached for Duo check is not affected.",
  "确认注销": "Confirm delete",
  "简介（会显示在卡片上）": "Bio (shown on your card)",
  "例如：晚上打，主玩辅助，想找稳一点的 ADC": "e.g. I play evenings, main support, looking for a steady ADC",
  "不要写联系方式，互选后对方才看得到你的 Riot ID。": "No contact details: matches see your Riot ID anyway.",
  "语言": "Languages",
  "语音": "Voice",
  "开麦": "Voice chat",
  "只打字": "Text only",
  "不说": "Rather not say",
  "常玩时间（你的当地时间）": "When you usually play (your local time)",
  "早上": "Mornings",
  "下午": "Afternoons",
  "晚上": "Evenings",
  "深夜": "Late nights",

  // 牌堆 filters and 现在想打
  "筛选": "Filters",
  "已开启": "On",
  "TA 想打": "Their roles",
  "现在想打": "Looking now",
  "筛选只决定哪些人出现，顺序仍按预测胜率。喜欢了你的人总会出现。": "Filters only decide who shows up; the order is still by predicted win rate. People who liked you always show up.",
  "{time} 前显示为现在想打，再点一下关掉": "Shown as looking now until {time}; tap again to turn it off",
  "别人会在卡片上看到你现在想打，{h} 小时后自动关掉": "Others see you're looking now on your card; it turns off by itself after {h} hours",
  "你开了筛选，放宽一些会看到更多人。": "Your filters are on; loosen them to see more people.",

  // messages from the site's own server code
  "请先登录": "Please log in first",
  "先在我的账号里绑定 Riot 账号": "Link your Riot account in My account first",
  "先在我的账号里开启“同意被推荐”，别人才能看到你": "Turn on “Recommend me” in My account so others can see you",
  "你的账号因被举报暂停推荐，等待管理员处理": "Your account is paused from recommendations after reports, pending an admin",
  "数据不足，请先选几个常玩英雄": "Too few games: pick a few champions you play first",
  "还在读取你的对局，请稍后再试": "Still reading your games, try again shortly",
  "预测服务暂时不可用": "The prediction service is unavailable right now",
  "连不上预测服务，请稍后再试": "Can't reach the prediction service, try again shortly",
  "不能滑自己": "You can't swipe yourself",
  "这名会员已经不在推荐池里": "This member is no longer in the pool",
  "已经滑过这名会员": "You've already swiped this member",
  "只能撤销最近一次跳过": "Only your last pass can be undone",
  "不能对自己这样做": "You can't do that to yourself",
  "这名会员已经注销": "This member deleted their account",
  "请选择举报理由": "Choose a reason",
  "至少选一个英雄": "Pick at least one champion",
  "自选英雄最多覆盖 2 个位置": "Picked champions can cover at most 2 roles",
  "参数不对": "Bad request",
  "请输入 Riot ID": "Enter a Riot ID",
  "这个 Riot 账号已经绑定了别的会员": "This Riot account is already linked to another member",
  "查询失败，请稍后再试": "Lookup failed, try again later",
  "验证已过期，请重新输入 Riot ID": "Verification expired; enter your Riot ID again",
  "这个 Riot ID 现在属于另一个账号，请重新开始": "This Riot ID now belongs to another account; start again",
  "绑定成功": "Linked",
  "已保存": "Saved",

  // client and Python API errors
  "服务器出错了，请稍后再试": "Something went wrong on the server, try again later",
  "服务没有这个接口，请确认 Python API 是最新版本": "The service doesn't have this endpoint; make sure the Python API is up to date",
  "连不上服务器，请确认网站和 Python API 都在运行": "Can't reach the server; make sure the site and the Python API are running",
  "Riot API Key 已失效，请在 .env 里换一个新的 Key 后重启服务": "The Riot API key has expired; put a new one in .env and restart",
  "Riot 接口太忙了，请过一两分钟再试": "Riot's API is busy, try again in a minute or two",
  "服务还没配置 Riot API Key": "The service has no Riot API key configured",
  "连不上 Riot 服务器，请稍后再试": "Can't reach Riot's servers, try again later",
  "两个 Riot ID 是同一个玩家，请填两个不同的人": "Both Riot IDs are the same player; enter two different people",
  "两人没有可分配的位置组合": "There's no role split that works for these two",
  "Riot ID 格式应为 名字#标签，例如 Faker#KR1": "A Riot ID looks like name#tag, for example Faker#KR1",
  "英雄联盟匹配搭子": "LoL Duo Finder",
}));

/** Python API text with names or numbers in it, and the model's 理由 (data/predict.py). */
const PATTERNS: [RegExp, string][] = [
  [/^请求没有成功（(\d+)），请检查输入后再试$/, "The request failed ($1); check your input and try again"],
  [/^今天的 (\d+) 次喜欢已经用完，明天再来$/, "You've used today's $1 likes; come back tomorrow"],
  [/^还没读到新头像：你现在戴的是 #(\d+)，需要换成 #(\d+)。换好后等几秒再点验证。$/, "We don't see the new icon yet: you wear #$1 and need #$2. Wait a few seconds after switching, then verify."],
  [/^想打的位置最多选 (\d+) 个$/, "Pick at most $1 roles"],
  [/^简介最多 (\d+) 个字$/, "Your bio can be at most $1 characters"],
  [/^简介里不能写联系方式或 Riot ID（“(.+)”），互选后对方才看得到$/, "Your bio can't contain contact details or a Riot ID (“$1”); matches see those after you both like each other"],
  [/^找不到美服玩家 (.+)$/, "No NA player named $1"],
  [/^找不到 (.+)，请检查名字和 # 后面的标签$/, "Can't find $1; check the name and the tag after #"],
  [/^(.+) 还没有查询过$/, "$1 hasn't been looked up yet"],
  [/^未知段位 (.+)$/, "Unknown tier $1"],
  [/^(.+) 本赛季未定级，按(.+)估算$/, "$1 is unranked this season, scored as $2"],
  [/^(.+) 数据不足，按自选英雄在(.+)的全服胜率估算$/, "$1 has too few games, scored from picked champions' win rates in $2"],
  [/^位置组合：(\S+) \+ (\S+) 是 (\d+) 种可行分配里预测胜率最高的$/, "Roles: $1 + $2 has the best predicted win rate of $3 possible splits"],
  [/^熟练度：(.+) 贡献 (\S+) 分，(.+) 贡献 (\S+) 分$/, "Proficiency: $1 adds $2, $3 adds $4"],
  [/^组合加成：(.+) \+ (.+) (\S+) 分（全服 (\d+) 局样本）$/, "Synergy: $1 + $2 $3 ($4 games)"],
  [/^段位差：两人同段位$/, "Rank gap: same tier"],
  [/^段位差：相差 (\d+) 个大段，修正项尚未用数据拟合，暂不计入$/, "Rank gap: $1 tiers apart; not fitted to data yet, so not counted"],
  [/^段位差：相差 (\d+) 个大段，修正 (\S+) 分$/, "Rank gap: $1 tiers apart, $2"],
];

const EN_POSITIONS: Record<string, string> = { TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid", BOTTOM: "Bot", UTILITY: "Support" };
const EN_TIERS: Record<string, string> = {
  IRON: "Iron", BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold", PLATINUM: "Platinum", EMERALD: "Emerald",
  DIAMOND: "Diamond", MASTER: "Master", GRANDMASTER: "Grandmaster", CHALLENGER: "Challenger",
};
const APEX = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);
// A captured group that is exactly a tier or position name (Chinese or Riot's code) becomes English;
// anything else (Riot IDs, champions, numbers) is kept as it is.
const NAMES = new Map<string, string>([
  ...Object.entries(TIER_LABELS).map(([k, zh]) => [zh, EN_TIERS[k]] as [string, string]),
  ...Object.entries(POSITION_LABELS).map(([k, zh]) => [zh, EN_POSITIONS[k]] as [string, string]),
  ...Object.entries(EN_POSITIONS),
]);

function fill(text: string, vars?: Record<string, string | number>) {
  return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(vars, k) ? String(vars[k]) : m)) : text;
}

export type T = ReturnType<typeof translator>;

export function translator(lang: Lang) {
  const t = (zh: string, vars?: Record<string, string | number>) => fill(lang === "en" ? EN.get(zh) ?? zh : zh, vars);
  return Object.assign(t, {
    lang,
    /** Text that came back from an API: exact phrases first, then the patterns above. */
    api(text: string) {
      if (lang === "zh" || !text) return text;
      const exact = EN.get(text);
      if (exact) return exact;
      for (const [re, en] of PATTERNS) {
        const m = text.match(re);
        if (m) return en.replace(/\$(\d)/g, (_, i) => NAMES.get(m[+i]) ?? m[+i]);
      }
      return text;
    },
    position: (p: string) => (lang === "en" ? EN_POSITIONS[p] : POSITION_LABELS[p]) ?? p,
    tier(tier: string | null, division?: string | null, lp?: number | null) {
      if (!tier) return lang === "en" ? "Unranked" : "未定级";
      const name = (lang === "en" ? EN_TIERS[tier] : TIER_LABELS[tier]) ?? tier;
      if (APEX.has(tier)) return lp != null ? `${name} ${lp} LP` : name;
      return division ? `${name} ${division}` : name;
    },
    pct: (x: number) => `${(x * 100).toFixed(1)}%`,
    /** 胜率差 in percentage points */
    points: (x: number) => (lang === "en" ? `${Math.abs(x * 100).toFixed(1)} pts` : `${Math.abs(x * 100).toFixed(1)} 个百分点`),
  });
}
