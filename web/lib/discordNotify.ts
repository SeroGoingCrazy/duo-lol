// 互选通知 by Discord DM (gap report item 13). Server only. Needs DISCORD_BOT_TOKEN, a bot of the site's Discord
// app; Discord only lets a bot DM someone who shares a server with it, so members join the site's server first.
// Best effort: a failed DM is logged (never the token) and the 互选 still shows on the site.
const API = "https://discord.com/api/v10";

export async function sendDiscordDm(discordUserId: string, content: string) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return false;
  const headers = { authorization: `Bot ${token}`, "content-type": "application/json" };
  try {
    const channel = await fetch(`${API}/users/@me/channels`, { method: "POST", headers, body: JSON.stringify({ recipient_id: discordUserId }) });
    if (!channel.ok) throw new Error(`open DM ${channel.status}`);
    const { id } = await channel.json();
    const sent = await fetch(`${API}/channels/${id}/messages`, {
      method: "POST", headers, body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    if (!sent.ok) throw new Error(`send DM ${sent.status}`);
    return true;
  } catch (e) {
    console.warn("Discord DM failed:", e instanceof Error ? e.message : e);
    return false;
  }
}
