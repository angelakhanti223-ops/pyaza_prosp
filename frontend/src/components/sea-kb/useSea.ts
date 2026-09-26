"use client";

import { useEffect, useState } from "react";

/** Загружает данные один раз на смену ключа; состояние не сбрасывается синхронно в эффекте. */
export function useSea<T>(key: string, loader: () => Promise<T>) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loader()
      .then((data) => !cancelled && setState({ key, data }))
      .catch((e: Error) => !cancelled && setState({ key, error: e.message }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = state && state.key === key ? state : null;
  return { data: current?.data, error: current?.error ?? null };
}
