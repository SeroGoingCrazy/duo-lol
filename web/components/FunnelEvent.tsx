"use client";
import { useEffect } from "react";
import { trackFunnel } from "@/lib/analytics";
import type { FunnelEventName, FunnelMode } from "@/lib/analyticsEvents";

export default function FunnelEvent({ event, mode = "member" }: { event: FunnelEventName; mode?: FunnelMode }) {
  useEffect(() => { trackFunnel(event, mode); }, [event, mode]);
  return null;
}
