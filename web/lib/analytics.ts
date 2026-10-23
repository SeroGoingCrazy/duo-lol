import type { FunnelEventName, FunnelMode } from "@/lib/analyticsEvents";

/** Best-effort, first-party funnel counts. A random per-tab ID never identifies a member. */
export function trackFunnel(event: FunnelEventName, mode: FunnelMode = "member") {
  if (typeof window === "undefined" || navigator.doNotTrack === "1") return;
  try {
    let session = sessionStorage.getItem("duo-funnel-session");
    if (!session) {
      session = crypto.randomUUID();
      sessionStorage.setItem("duo-funnel-session", session);
    }
    void fetch("/api/analytics", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, mode, session }), keepalive: true,
    }).catch(() => {});
  } catch { /* Private browsing / disabled storage must not interrupt the product. */ }
}
