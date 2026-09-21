"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { listLeads, STATUS_OPTIONS, type LeadListItem, type LeadStatus } from "@/lib/crmApi";
import StatusBadge from "@/components/crm/StatusBadge";
import NewLeadModal from "@/components/crm/NewLeadModal";
import { getLeadStatusHint, getLeadStatusLabel } from "@/components/crm/LeadStatusInfo";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU");
}

function formatMoney(value: string | null) {
  if (!value) return "—";
  const number = Number(value);
  if (Number.isNaN(number)) return `${value} ₽`;
  return `${new Intl.NumberFormat("ru-RU").format(number)} ₽`;
}

function isPast(value: string | null) {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
}

export default function CrmLeadsPage() {
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

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

  const overdueContacts = useMemo(() => leads.filter((lead) => isPast(lead.next_contact_at)).length, [leads]);
  const overduePayments = useMemo(() => leads.filter((lead) => isPast(lead.full_payment_due_at)).length, [leads]);
  const selectedStatusHint = status ? getLeadStatusHint(status as LeadStatus) : "Выберите статус, чтобы увидеть подсказку по этапу работы с заявкой.";

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Заявки туристов</h1>
          <p className="mt-1 text-xs text-foreground/50">
            Контроль повторных контактов, оплат и этапов продажи. Просрочено контактов: {overdueContacts}, оплат: {overduePayments}.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue"
        >
          + Создать обращение
        </button>
      </div>

      {showCreate && (
        <NewLeadModal
          onClose={() => setShowCreate(false)}
          onCreated={(lead) => {
            setShowCreate(false);
            setLeads((prev) => [lead, ...prev]);
          }}
        />
      )}

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
              {getLeadStatusLabel(s.value, s.label)}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 rounded-2xl border border-blue-light bg-blue-light/35 px-4 py-3 text-xs leading-relaxed text-foreground/70">
        {selectedStatusHint}
      </div>

      <div className="overflow-auto rounded-2xl border border-black/5 bg-white">
        <table className="min-w-[1180px] w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-blue-light/40 text-xs text-foreground/50">
            <tr>
              <th className="px-4 py-3 font-medium">Клиент</th>
              <th className="px-4 py-3 font-medium">Тур</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Следующий контакт</th>
              <th className="px-4 py-3 font-medium">Оплата</th>
              <th className="px-4 py-3 font-medium">Дедлайн оплаты</th>
              <th className="px-4 py-3 font-medium">Менеджер</th>
              <th className="px-4 py-3 font-medium">Создана</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const contactOverdue = isPast(lead.next_contact_at);
              const paymentOverdue = isPast(lead.full_payment_due_at);
              return (
                <tr key={lead.id} className="border-b border-black/5 last:border-0 hover:bg-blue-light/20">
                  <td className="px-4 py-3 align-top">
                    <Link href={`/crm/leads/${lead.id}`} className="font-medium text-navy hover:underline">
                      {lead.name}
                    </Link>
                    <p className="mt-1 text-xs text-foreground/50">{lead.phone}</p>
                    {lead.email && <p className="text-xs text-foreground/40">{lead.email}</p>}
                  </td>
                  <td className="px-4 py-3 align-top text-foreground/70">
                    <p>{lead.direction_name ?? "—"}</p>
                    <p className="mt-1 text-xs text-foreground/45">
                      {lead.departure_city || "город не указан"}
                      {lead.departure_date && <> · {formatDate(lead.departure_date)}</>}
                      {lead.nights && <> · {lead.nights} н.</>}
                    </p>
                    {lead.budget_to && <p className="text-xs text-foreground/45">Бюджет до {formatMoney(lead.budget_to)}</p>}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge status={lead.status} label={lead.status_display} />
                    {lead.failure_reason && <p className="mt-1 text-xs text-red-600">{lead.failure_reason}</p>}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className={contactOverdue ? "font-semibold text-red-600" : "text-foreground/70"}>
                      {formatDateTime(lead.next_contact_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-foreground/70">
                    <p>Тур: {formatMoney(lead.deal_amount)}</p>
                    <p className="text-xs text-foreground/45">Оплачено: {formatMoney(lead.paid_amount)}</p>
                    <p className="text-xs text-foreground/45">Остаток: {formatMoney(lead.balance_due)}</p>
                    <p className="text-xs text-foreground/45">Комиссия: {formatMoney(lead.commission)}</p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className={paymentOverdue ? "font-semibold text-red-600" : "text-foreground/70"}>
                      {formatDateTime(lead.full_payment_due_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-foreground/70">
                    {lead.assigned_manager?.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 align-top text-foreground/50">
                    {new Date(lead.created_at).toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              );
            })}
            {!loading && leads.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-foreground/40">
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
