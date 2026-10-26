"use client";

import { X } from "lucide-react";
import { useLeadForm } from "./LeadFormContext";
import LeadForm from "./LeadForm";

export default function LeadFormModal() {
  const { isOpen, close, prefillComment } = useLeadForm();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-dark/60 p-4"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Подобрать тур"
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="Закрыть"
          className="absolute right-4 top-4 text-foreground/40 transition-colors hover:text-foreground"
        >
          <X size={22} />
        </button>
        <h3 className="mb-1 text-xl font-bold text-navy">Подобрать тур</h3>
        <p className="mb-5 text-sm text-foreground/60">
          Оставьте заявку — перезвоним и подберём идеальный вариант
        </p>
        <LeadForm onSuccess={() => setTimeout(close, 2500)} initialComment={prefillComment} />
      </div>
    </div>
  );
}
