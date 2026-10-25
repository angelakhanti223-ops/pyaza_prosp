"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo, useState } from "react";

type LeadFormContextValue = {
  isOpen: boolean;
  prefillComment: string;
  open: (comment?: string) => void;
  close: () => void;
};

const LeadFormContext = createContext<LeadFormContextValue | null>(null);

export function LeadFormProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [prefillComment, setPrefillComment] = useState("");

  const value = useMemo(
    () => ({
      isOpen,
      prefillComment,
      open: (comment?: string) => {
        if (pathname === "/gift-certificates") {
          document.getElementById("application")?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        setPrefillComment(comment ?? "");
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
    }),
    [isOpen, prefillComment, pathname]
  );

  return <LeadFormContext.Provider value={value}>{children}</LeadFormContext.Provider>;
}

export function useLeadForm() {
  const ctx = useContext(LeadFormContext);
  if (!ctx) {
    throw new Error("useLeadForm must be used within LeadFormProvider");
  }
  return ctx;
}
