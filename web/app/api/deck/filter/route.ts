import { DeckError, respond, setFilter } from "@/lib/deckServer";

export async function POST(req: Request) {
  return respond(async () => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") throw new DeckError(400, "参数不对");
    return setFilter(body);
  });
}
