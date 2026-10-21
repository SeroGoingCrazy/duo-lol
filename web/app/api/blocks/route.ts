import { block, DeckError, respond } from "@/lib/deckServer";

export async function POST(req: Request) {
  return respond(async () => {
    const { to } = await req.json().catch(() => ({}));
    if (typeof to !== "string") throw new DeckError(400, "参数不对");
    return block(to);
  });
}
