"use client";

import { useEffect, useRef } from "react";

const MAX_ACTIVE_MS = 2 * 60 * 60 * 1000;
type Reading = { slug: string; id: string; activeMs: number; started: boolean };

function viewId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  return Array.from(bytes, (value, index) => `${[4, 6, 8, 10].includes(index) ? "-" : ""}${value.toString(16).padStart(2, "0")}`).join("");
}

function endpoint(slug: string) {
  let base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  if (!["localhost", "127.0.0.1"].includes(location.hostname) && /localhost|127\.0\.0\.1/.test(base)) base = "";
  return `${base}/api/articles/${encodeURIComponent(slug)}/read-event/`;
}

export default function ArticleReadTracker({ slug }: { slug: string }) {
  const reading = useRef<Reading | null>(null);

  useEffect(() => {
    if (!reading.current || reading.current.slug !== slug) {
      reading.current = { slug, id: viewId(), activeMs: 0, started: false };
    }
    let state = reading.current;
    let runningSince: number | null = null;
    let pageHidden = false;
    const url = endpoint(slug);
    const eligible = () => !pageHidden && document.visibilityState === "visible" && document.hasFocus();
    const capture = () => {
      if (runningSince !== null) {
        const now = performance.now();
        state.activeMs = Math.min(MAX_ACTIVE_MS, state.activeMs + Math.max(0, now - runningSince));
        runningSince = now;
      }
      return Math.round(state.activeMs);
    };
    const send = (kind: "start" | "progress" | "end", beacon = false) => {
      if (!state.started) return;
      const body = JSON.stringify({ view_id: state.id, active_ms: capture(), kind });
      if (beacon && typeof navigator.sendBeacon === "function") {
        try {
          if (navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))) return;
        } catch { /* Fall back to a keepalive request. */ }
      }
      void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, credentials: "omit", keepalive: true }).catch(() => {});
    };
    const update = () => {
      capture();
      if (eligible()) {
        runningSince = performance.now();
        if (!state.started) {
          state.started = true;
          send("start");
        }
      } else {
        runningSince = null;
        send("end", true);
      }
    };
    const hide = () => {
      capture();
      pageHidden = true;
      runningSince = null;
      send("end", true);
    };
    const show = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Returning from the browser's page cache is a new opening, not extra time on the old one.
        state = { slug, id: viewId(), activeMs: 0, started: false };
        reading.current = state;
      }
      pageHidden = false;
      update();
    };
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    const heartbeat = window.setInterval(() => {
      if (eligible() && state.activeMs < MAX_ACTIVE_MS) send("progress");
    }, 15000);
    update();
    return () => {
      capture();
      runningSince = null;
      send("end", true);
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
    };
  }, [slug]);

  return null;
}
