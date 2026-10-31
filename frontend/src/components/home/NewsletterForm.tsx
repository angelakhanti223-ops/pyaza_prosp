"use client";

import { useState } from "react";
import { ApiError, subscribe } from "@/lib/api";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorText, setErrorText] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setErrorText("");
    if (!consent) {
      setStatus("error");
      return;
    }
    setStatus("submitting");
    try {
      await subscribe({ email, consent });
      setStatus("success");
    } catch (error) {
      setErrorText(error instanceof ApiError ? Object.values(error.fieldErrors).flat().join(" ") : "");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-navy-dark">
        Вы подписаны — спасибо!
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          required
          type="email"
          placeholder="Ваш email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm text-white placeholder:text-white/50 outline-none focus:border-gold"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="shrink-0 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-navy-dark transition-colors hover:bg-gold-dark disabled:opacity-60"
        >
          {status === "submitting" ? "…" : "Подписаться"}
        </button>
      </div>
      <label className="mt-2 flex items-start gap-2 text-[11px] text-white/50">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
        />
        <span>Согласен на получение рассылки и обработку персональных данных. <a href="/consents/marketing" target="_blank" rel="noopener noreferrer" className="underline">Условия рассылки</a></span>
      </label>
      {status === "error" && (
        <p role="alert" className="mt-1 text-xs text-red-300">
          {consent ? errorText || "Не удалось подписаться. Попробуйте ещё раз." : "Подтвердите согласие на рассылку."}
        </p>
      )}
    </form>
  );
}
