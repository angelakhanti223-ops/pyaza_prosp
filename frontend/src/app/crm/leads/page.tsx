"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { listLeads, STATUS_OPTIONS, type LeadListItem } from "@/lib/crmApi";
import StatusBadge from "@/components/crm/StatusBadge";

export default function CrmLeadsPage() {
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      setLoading(true);
      listLeads({ status: status || undefined, search: search || undefined }).then((data) => {
        if (!active) return;
        setLeads(data);
        setLoading(false);
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [status, search]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-navy">Заявки</h1>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input
            type="text"
            placeholder="Поиск по имени, телефону, email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue"
        >
          <option value="">Все статусы</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-blue-light/40 text-xs text-foreground/50">
            <tr>
              <th className="px-4 py-3 font-medium">Клиент</th>
              <th className="px-4 py-3 font-medium">Телефон</th>
              <th className="px-4 py-3 font-medium">Направление</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Менеджер</th>
              <th className="px-4 py-3 font-medium">Сумма</th>
              <th className="px-4 py-3 font-medium">Создана</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-black/5 last:border-0 hover:bg-blue-light/20">
                <td className="px-4 py-3">
                  <Link href={`/crm/leads/${lead.id}`} className="font-medium text-navy hover:underline">
                    {lead.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground/70">{lead.phone}</td>
                <td className="px-4 py-3 text-foreground/70">{lead.direction_name ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={lead.status} label={lead.status_display} />
                </td>
                <td className="px-4 py-3 text-foreground/70">
                  {lead.assigned_manager?.full_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-foreground/70">
                  {lead.deal_amount ? `${lead.deal_amount} ₽` : "—"}
                </td>
                <td className="px-4 py-3 text-foreground/50">
                  {new Date(lead.created_at).toLocaleDateString("ru-RU")}
                </td>
              </tr>
            ))}
            {!loading && leads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-foreground/40">
                  Заявок пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
