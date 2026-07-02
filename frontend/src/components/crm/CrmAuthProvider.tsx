"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchMe, logout as apiLogout, type CrmUser } from "@/lib/crmApi";

type CrmAuthContextValue = {
  user: CrmUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const CrmAuthContext = createContext<CrmAuthContextValue | null>(null);

export function CrmAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CrmUser | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  const refresh = useCallback(async () => {
    const me = await fetchMe();
    setUser(me);
    setStatus(me ? "authenticated" : "unauthenticated");
  }, []);

  useEffect(() => {
    let active = true;
    fetchMe().then((me) => {
      if (!active) return;
      setUser(me);
      setStatus(me ? "authenticated" : "unauthenticated");
    });
    return () => {
      active = false;
    };
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  return (
    <CrmAuthContext.Provider value={{ user, status, refresh, logout }}>
      {children}
    </CrmAuthContext.Provider>
  );
}

export function useCrmAuth() {
  const ctx = useContext(CrmAuthContext);
  if (!ctx) throw new Error("useCrmAuth must be used within CrmAuthProvider");
  return ctx;
}
