"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { disableTaskPush, enableTaskPush, getTaskPushConfig, testTaskPush } from "@/lib/crmApi";

function applicationKey(value: string): Uint8Array<ArrayBuffer> {
  const decoded = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(decoded, char => char.charCodeAt(0));
}

export default function BrowserTaskNotifications() {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const available = window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    Promise.resolve().then(async () => {
      if (!active) return;
      setSupported(available);
      if (available) {
        try {
          const config = await getTaskPushConfig();
          const registration = await navigator.serviceWorker.getRegistration("/crm/");
          const subscription = await registration?.pushManager.getSubscription();
          if (active) setEnabled(Boolean(config.enabled && subscription && Notification.permission === "granted"));
        } catch { if (active) setMessage("Не удалось проверить уведомления. Можно повторить подключение."); }
      }
      if (active) setBusy(false);
    });
    return () => { active = false; };
  }, []);

  async function toggle() {
    setBusy(true); setMessage("");
    try {
      if (enabled) {
        const registration = await navigator.serviceWorker.getRegistration("/crm/");
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) { await disableTaskPush(subscription.endpoint); await subscription.unsubscribe(); }
        await Promise.all((await registration?.getNotifications() ?? []).map(notification => notification.close()));
        setEnabled(false); setMessage("Уведомления отключены в этом браузере.");
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setMessage(permission === "denied" ? "Уведомления запрещены. Разрешите их для flypenza.ru в настройках браузера и повторите подключение." : "Разрешение не получено. Уведомления пока отключены.");
          return;
        }
        const config = await getTaskPushConfig();
        await navigator.serviceWorker.register("/crm-task-sw.js", { scope: "/crm/", updateViaCache: "none" });
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (subscription && subscription.options.applicationServerKey) {
          const expected = applicationKey(config.public_key);
          const actual = new Uint8Array(subscription.options.applicationServerKey);
          if (actual.length !== expected.length || actual.some((byte, index) => byte !== expected[index])) { await subscription.unsubscribe(); subscription = null; }
        }
        subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(config.public_key) });
        await enableTaskPush(subscription.toJSON());
        setEnabled(true); setMessage("Будем напоминать о сроках ваших задач. Нажмите «Проверить», чтобы отправить тест.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось подключить уведомления."); }
    finally { setBusy(false); }
  }

  async function test() {
    setBusy(true); setMessage("");
    try { await testTaskPush(); setMessage("Тест передан push-сервису. Проверьте уведомления браузера и системы."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось отправить тест."); }
    finally { setBusy(false); }
  }

  return (
    <div className="border-b border-black/5 bg-white px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="flex items-center gap-2 font-medium text-navy"><Bell size={15} aria-hidden="true" />Напоминания о задачах</span>
        {supported ? <>
          <button type="button" onClick={toggle} disabled={busy} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-navy/15 px-3 py-2 font-semibold text-navy hover:bg-blue-light disabled:opacity-50">{enabled ? <BellOff size={13} aria-hidden="true" /> : <Bell size={13} aria-hidden="true" />}{busy ? "Подождите…" : enabled ? "Отключить уведомления" : "Включить уведомления"}</button>
          {enabled && <button type="button" onClick={test} disabled={busy} className="min-h-9 text-blue underline underline-offset-4 disabled:opacity-50">Проверить</button>}
          <span className="text-foreground/55">{enabled ? "Включены для этого браузера и текущего входа в CRM" : "По сроку задачи · только ваши задачи"}</span>
        </> : <span className="text-foreground/60">В этом браузере Web Push недоступен. Откройте CRM в браузере с поддержкой уведомлений по HTTPS.</span>}
      </div>
      {message && <p role="status" className="mt-2 text-xs leading-5 text-foreground/65">{message}</p>}
    </div>
  );
}
