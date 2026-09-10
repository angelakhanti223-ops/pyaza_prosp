"use client";

import { createContext, useContext, useMemo, useState } from "react";

type LeadFormContextValue = {
  isOpen: boolean;
  prefillComment: string;
  open: (comment?: string) => void;
  close: () => void;
};

const LeadFormContext = createContext<LeadFormContextValue | null>(null);

export function LeadFormProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefillComment, setPrefillComment] = useState("");

  const value = useMemo(
    () => ({
      isOpen,
      prefillComment,
      open: (comment?: string) => {
        setPrefillComment(comment ?? "");
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
    }),
    [isOpen, prefillComment]
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
