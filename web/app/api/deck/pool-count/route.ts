import { complementaryPoolCount } from "@/lib/complementaryPool";
import { respond } from "@/lib/deckServer";

export const dynamic = "force-dynamic";
// Kept separate from deck/nav responses: only an empty 牌堆 asks for this count.
export const GET = () => respond(complementaryPoolCount);
