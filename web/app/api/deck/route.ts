// PRD-v2 §6.1 GET /api/deck. Next serves this itself; other /api/* paths go to the Python API.
import { deck, respond } from "@/lib/deckServer";

export const dynamic = "force-dynamic";
export const GET = () => respond(deck);
