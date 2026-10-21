import { cancelMutual, DeckError, mutualLikesOf, respond } from "@/lib/deckServer";

export const dynamic = "force-dynamic";
export const GET = () => respond(mutualLikesOf);

/** Body { with: memberId }; a body instead of a path segment keeps this a static route ahead of the proxy. */
export async function DELETE(req: Request) {
  return respond(async () => {
    const { with: other } = await req.json().catch(() => ({}));
    if (typeof other !== "string") throw new DeckError(400, "参数不对");
    return cancelMutual(other);
  });
}
