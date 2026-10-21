// Riot's developer portal verifies the site by fetching /riot.txt; paste the code it shows into RIOT_VERIFICATION.
export const dynamic = "force-dynamic";

export function GET() {
  const code = process.env.RIOT_VERIFICATION?.trim();
  if (!code) return new Response("Not Found", { status: 404 });
  return new Response(code, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
