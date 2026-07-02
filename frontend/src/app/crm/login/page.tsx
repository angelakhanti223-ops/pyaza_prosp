"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCrmAuth } from "@/components/crm/CrmAuthProvider";
import { login as apiLogin } from "@/lib/crmApi";

export default function CrmLoginPage() {
  const { status, refresh } = useCrmAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/crm/dashboard");
    }
  }, [status, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await apiLogin(username, password);
      await refresh();
      router.replace("/crm/dashboard");
    } catch {
      setError("Неверный логин или пароль");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-light/40 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-sm"
      >
        <h1 className="text-xl font-bold text-navy">
          Слетать<span className="text-gold">.ру</span>
        </h1>
        <p className="mb-6 mt-1 text-sm text-foreground/60">Вход в мини-CRM</p>

        <div className="flex flex-col gap-3">
          <input
            required
            type="text"
            placeholder="Логин"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue"
          />
          <input
            required
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue"
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue disabled:opacity-60"
        >
          {submitting ? "Входим…" : "Войти"}
        </button>
      </form>
    </div>
  );
}
