"use client";

import { useLeadForm } from "./LeadFormContext";

type Props = {
  className?: string;
  children: React.ReactNode;
  comment?: string;
};

export default function OpenLeadFormButton({ className, children, comment }: Props) {
  const { open } = useLeadForm();
  return (
    <button type="button" onClick={() => open(comment)} className={className}>
      {children}
    </button>
  );
}
