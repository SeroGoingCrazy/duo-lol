// Shared by the server and the 头像 picker in the browser.

/** public/profileicons/icons.json: [id, Chinese title, English title, year released], newest first. */
export type ProfileIconList = { version: string; icons: [number, string, string, number][] };

export const profileIconUrl = (version: string, id: number) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${id}.png`;
