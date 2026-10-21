import { DeckError, respond, swipe } from "@/lib/deckServer";

export async function POST(req: Request) {
  return respond(async () => {
    const { to, action } = await req.json().catch(() => ({}));
    if (typeof to !== "string" || (action !== "like" && action !== "pass")) throw new DeckError(400, "参数不对");
    return swipe(to, action);
  });
}
