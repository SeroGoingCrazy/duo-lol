import { DeckError, report, respond } from "@/lib/deckServer";

export async function POST(req: Request) {
  return respond(async () => {
    const { to, reason, detail } = await req.json().catch(() => ({}));
    if (typeof to !== "string" || typeof reason !== "string") throw new DeckError(400, "参数不对");
    return report(to, reason, typeof detail === "string" ? detail : "");
  });
}
