const EVENT = "crm-tasks-changed";
const CHANNEL = "flypenza-crm-tasks";

export function notifyTaskChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage("changed");
    channel.close();
  }
}

export function listenForTaskChanges(refresh: () => void) {
  const visible = () => { if (document.visibilityState === "visible") refresh(); };
  window.addEventListener(EVENT, refresh);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", visible);
  // Pick up edits from colleagues, background jobs and the bot while this page stays open.
  const interval = window.setInterval(visible, 30_000);
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL) : null;
  if (channel) channel.onmessage = refresh;
  return () => {
    window.removeEventListener(EVENT, refresh);
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", visible);
    window.clearInterval(interval);
    channel?.close();
  };
}
