"use client";

import { useLeadForm } from "./LeadFormContext";

type Props = {
  className?: string;
  children: React.ReactNode;
};

export default function OpenLeadFormButton({ className, children }: Props) {
  const { open } = useLeadForm();
  return (
    <button type="button" onClick={open} className={className}>
      {children}
    </button>
  );
}
