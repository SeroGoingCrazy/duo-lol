import { NextRequest, NextResponse } from "next/server";
import { lt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { FUNNEL_EVENTS, FUNNEL_MODES, type FunnelEventName, type FunnelMode } from "@/lib/analyticsEvents";

let cleanedAt = 0;

export async function POST(req: NextRequest) {
  if (req.headers.get("dnt") === "1") return new NextResponse(null, { status: 204 });
  const origin = req.headers.get("origin");
  // Next's internal URL can use localhost even when the browser addressed 127.0.0.1.
  // Use the HTTP Host, which is also the public host behind the deployment proxy.
  const requestOrigin = `${req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.slice(0, -1)}://${req.headers.get("host") ?? req.nextUrl.host}`;
  if (origin && origin !== requestOrigin) return new NextResponse(null, { status: 403 });
  if (Number(req.headers.get("content-length") ?? 0) > 512) return new NextResponse(null, { status: 413 });
  let payload: unknown;
  const reader = req.body?.getReader();
  if (!reader) return new NextResponse(null, { status: 400 });
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let bytes = 0;
    let text = "";
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 512) {
        await reader.cancel();
        return new NextResponse(null, { status: 413 });
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    payload = JSON.parse(text);
  } catch {
    await reader.cancel().catch(() => {});
    return new NextResponse(null, { status: 400 });
  } finally { reader.releaseLock(); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return new NextResponse(null, { status: 400 });
  const data = payload as Record<string, unknown>;
  if (Object.keys(data).some((k) => !["event", "mode", "session"].includes(k)) ||
    !FUNNEL_EVENTS.includes(data.event as FunnelEventName) || !FUNNEL_MODES.includes(data.mode as FunnelMode) ||
    typeof data.session !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.session)) {
    return new NextResponse(null, { status: 400 });
  }
  try {
    const db = await getDb();
    // Enforce retention on ingestion, at most once an hour per process.
    if (Date.now() - cleanedAt > 3_600_000) {
      await db.delete(schema.funnelEvents).where(lt(schema.funnelEvents.createdAt, new Date(Date.now() - 30 * 86_400_000)));
      cleanedAt = Date.now();
    }
    await db.insert(schema.funnelEvents).values({
      session: data.session, event: data.event as FunnelEventName, mode: data.mode as FunnelMode,
    }).onConflictDoNothing();
    return new NextResponse(null, { status: 204 });
  } catch { return new NextResponse(null, { status: 503 }); }
}
