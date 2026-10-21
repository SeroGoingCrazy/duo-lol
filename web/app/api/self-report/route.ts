import { DeckError, respond, saveSelfReport } from "@/lib/deckServer";

export async function POST(req: Request) {
  return respond(async () => {
    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.picks)) throw new DeckError(400, "参数不对");
    return saveSelfReport(body);
  });
}
