import { DeckError, respond, setLooking } from "@/lib/deckServer";

export async function POST(req: Request) {
  return respond(async () => {
    const { on } = await req.json().catch(() => ({}));
    if (typeof on !== "boolean") throw new DeckError(400, "参数不对");
    return setLooking(on);
  });
}
