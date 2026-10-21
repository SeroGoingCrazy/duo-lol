import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PlayerProfile from "@/components/PlayerProfile";
import { riotIdFromSlug } from "@/lib/api";
import { getT } from "@/lib/lang";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const riotId = riotIdFromSlug((await params).slug);
  return { title: riotId ?? (await getT())("玩家资料") };
}

/** 玩家资料页: one Riot ID's rank, champions and latest games, from the same public data as 查组合. */
export default async function PlayerPage({ params }: Props) {
  const riotId = riotIdFromSlug((await params).slug);
  if (!riotId) notFound();
  return <PlayerProfile riotId={riotId} />;
}
