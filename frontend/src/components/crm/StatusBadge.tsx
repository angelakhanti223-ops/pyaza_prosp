import type { LeadStatus } from "@/lib/crmApi";

const COLORS: Record<LeadStatus, string> = {
  new: "bg-blue-light text-blue",
  follow_up: "bg-indigo-100 text-indigo-700",
  in_progress: "bg-amber-100 text-amber-700",
  selection: "bg-violet-100 text-violet-700",
  options_proposed: "bg-purple-100 text-purple-700",
  booked: "bg-sky-100 text-sky-700",
  prepaid: "bg-teal-100 text-teal-700",
  waiting_payment: "bg-orange-100 text-orange-700",
  paid: "bg-emerald-100 text-emerald-700",
  departure: "bg-cyan-100 text-cyan-700",
  check_in: "bg-lime-100 text-lime-700",
  returned: "bg-slate-100 text-slate-700",
  closed_won: "bg-green-100 text-green-800",
  closed_lost: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
  not_target: "bg-zinc-100 text-zinc-700",
};

export default function StatusBadge({ status, label }: { status: LeadStatus; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        COLORS[status] ?? "bg-black/5 text-foreground/70"
      }`}
    >
      {label}
    </span>
  );
}
