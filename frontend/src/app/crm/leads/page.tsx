"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { listLeads, updateLead, STATUS_OPTIONS, type LeadListItem, type LeadStatus } from "@/lib/crmApi";
import StatusBadge from "@/components/crm/StatusBadge";
import NewLeadModal from "@/components/crm/NewLeadModal";
import { getLeadStatusHint, getLeadStatusLabel } from "@/components/crm/LeadStatusInfo";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type RateDirection = "higher" | "lower" | "same" | "missing";

type LeadTag = {
  id: number;
  name: string;
  color: string;
  is_active: boolean;
};

type LeadWithOperatorRate = LeadListItem & {
  tags?: LeadTag[];
  tour_operator_ref?: number | null;
  tour_operator_details?: { brand_name: string } | null;
  tour_currency?: string;
  payment_exchange_rate?: string | null;
  operator_current_rate?: string | null;
  operator_current_rate_date?: string | null;
  operator_rate_source_note?: string;
  operator_rate_direction?: RateDirection;
  operator_rate_delta?: string | null;
};

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

function formatRate(value: string | null | undefined) {
  if (!value) return "—";
  const number = Number(value);
  if (Number.isNaN(number)) return value;
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(number);
}

function rateClass(direction?: RateDirection) {
  if (direction === "higher") return "font-semibold text-red-600";
  if (direction === "lower") return "font-semibold text-emerald-600";
  if (direction === "same") return "font-semibold text-foreground/70";
  return "text-foreground/45";
}

function rateDeltaLabel(delta: string | null | undefined) {
  if (!delta) return "";
  const number = Number(delta);
  if (Number.isNaN(number)) return delta;
  if (number > 0) return `+${formatRate(delta)}`;
  return formatRate(delta);
}

function isPast(value: string | null) {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
}

function getReasonLabel(status: LeadStatus) {
  if (status === "failed") return "Причина провала";
  if (status === "closed_lost") return "Причина неуспешной заявки";
  if (status === "not_target") return "Причина нецелевого обращения";
  return "Причина закрытия";
}

async function listLeadTags(): Promise<LeadTag[]> {
  const res = await fetch(`${API_BASE_URL}/api/crm/lead-tags/`, { credentials: "include", cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

function tagChipClass(active = true) {
  return active
    ? "inline-flex items-center rounded-full bg-blue-light px-2 py-0.5 text-[11px] font-medium text-navy"
    : "inline-flex items-center rounded-full border border-black/10 px-2 py-0.5 text-[11px] text-foreground/45";
}

export default function CrmLeadsPage() {
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [allTags, setAllTags] = useState<LeadTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [savingTagLeadId, setSavingTagLeadId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    listLeadTags().then(setAllTags);
  }, []);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      setLoading(true);
      listLeads({ status: status || undefined, search: search || undefined }).then((data) => {
        if (!active) return;
        setLeads(data);
        setLoading(false);
      }).catch(() => {
        if (!active) return;
        setLeads([]);
        setLoading(false);
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [status, search]);

  const displayedLeads = useMemo(() => {
    if (!tagFilter) return leads;
    return leads.filter((lead) => ((lead as LeadWithOperatorRate).tags ?? []).some((tag) => String(tag.id) === tagFilter));
  }, [leads, tagFilter]);

  const overdueContacts = useMemo(() => displayedLeads.filter((lead) => isPast(lead.next_contact_at)).length, [displayedLeads]);
  const overduePayments = useMemo(() => displayedLeads.filter((lead) => isPast(lead.full_payment_due_at)).length, [displayedLeads]);
  const selectedStatusHint = status ? getLeadStatusHint(status as LeadStatus) : "Выберите статус, чтобы увидеть подсказку по этапу работы с заявкой.";

  async function toggleTag(lead: LeadWithOperatorRate, tagId: number) {
    const currentTagIds = (lead.tags ?? []).map((tag) => tag.id);
    const nextTagIds = currentTagIds.includes(tagId)
      ? currentTagIds.filter((id) => id !== tagId)
      : [...currentTagIds, tagId];

    setSavingTagLeadId(lead.id);
    try {
      const updatedLead = await updateLead(lead.id, { tag_ids: nextTagIds } as never);
      setLeads((prev) => prev.map((item) => item.id === lead.id ? updatedLead : item));
    } finally {
      setSavingTagLeadId(null);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Заявки туристов</h1>
          <p className="mt-1 text-xs text-foreground/50">
            Контроль повторных контактов, оплат, этапов продажи и курсов туроператоров. Просрочено контактов: {overdueContacts}, оплат: {overduePayments}.
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
            <option key={s.value} value={s.value}>{getLeadStatusLabel(s.value, s.label)}</option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue"
        >
          <option value="">Все метки</option>
          {allTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
        </select>
      </div>

      <div className="mb-4 rounded-2xl border border-blue-light bg-blue-light/35 px-4 py-3 text-xs leading-relaxed text-foreground/70">
        {selectedStatusHint}
      </div>

      <div className="overflow-auto rounded-2xl border border-black/5 bg-white">
        <table className="min-w-[1540px] w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-blue-light/40 text-xs text-foreground/50">
            <tr>
              <th className="px-4 py-3 font-medium">Клиент</th>
              <th className="px-4 py-3 font-medium">Тур</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Метки</th>
              <th className="px-4 py-3 font-medium">Следующий контакт</th>
              <th className="px-4 py-3 font-medium">Оплата</th>
              <th className="px-4 py-3 font-medium">Курс ТО</th>
              <th className="px-4 py-3 font-medium">Дедлайн оплаты</th>
              <th className="px-4 py-3 font-medium">Менеджер</th>
              <th className="px-4 py-3 font-medium">Создана</th>
            </tr>
          </thead>
          <tbody>
            {displayedLeads.map((lead) => {
              const row = lead as LeadWithOperatorRate;
              const rowTagIds = (row.tags ?? []).map((tag) => tag.id);
              const contactOverdue = isPast(lead.next_contact_at);
              const paymentOverdue = isPast(lead.full_payment_due_at);
              const hasOperator = Boolean(row.tour_operator_ref || row.tour_operator_details || row.tour_operator);
              return (
                <tr key={lead.id} className="border-b border-black/5 last:border-0 hover:bg-blue-light/20">
                  <td className="px-4 py-3 align-top">
                    <Link href={`/crm/leads/${lead.id}`} className="font-medium text-navy hover:underline">
                      {lead.name}
                    </Link>
                    <p className="mt-1 text-xs text-foreground/50">{lead.phone}</p>
                    {lead.email && <p className="text-xs text-foreground/40">{lead.email}</p>}
                    <p className="mt-1 text-xs text-foreground/35">Источник: {lead.source_display}</p>
                  </td>
                  <td className="px-4 py-3 align-top text-foreground/70">
                    <p>{lead.direction_name ?? "—"}</p>
                    <p className="mt-1 text-xs text-foreground/45">
                      {lead.departure_city || "город не указан"}
                      {lead.departure_date && <> · {formatDate(lead.departure_date)}</>}
                      {lead.nights && <> · {lead.nights} н.</>}
                    </p>
                    {row.tour_operator_details?.brand_name && <p className="text-xs text-foreground/45">ТО: {row.tour_operator_details.brand_name}</p>}
                    {!row.tour_operator_details?.brand_name && row.tour_operator && <p className="text-xs text-foreground/45">ТО: {row.tour_operator}</p>}
                    {lead.budget_to && <p className="text-xs text-foreground/45">Бюджет до {formatMoney(lead.budget_to)}</p>}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge status={lead.status} label={getLeadStatusLabel(lead.status, lead.status_display)} />
                    {lead.failure_reason && (
                      <p className="mt-1 text-xs text-red-600">{getReasonLabel(lead.status)}: {lead.failure_reason}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex max-w-[210px] flex-wrap gap-1">
                      {allTags.map((tag) => {
                        const active = rowTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            disabled={savingTagLeadId === lead.id}
                            onClick={() => toggleTag(row, tag.id)}
                            className={`${tagChipClass(active)} disabled:opacity-50`}
                            title={active ? "Убрать метку" : "Добавить метку"}
                          >
                            {active ? "✓ " : "+ "}{tag.name}
                          </button>
                        );
                      })}
                      {allTags.length === 0 && <span className="text-xs text-foreground/35">Метки не заведены</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className={contactOverdue ? "font-semibold text-red-600" : "text-foreground/70"}>{formatDateTime(lead.next_contact_at)}</span>
                  </td>
                  <td className="px-4 py-3 align-top text-foreground/70">
                    <p>Тур: {formatMoney(lead.deal_amount)}{row.tour_currency && <> · {row.tour_currency}</>}</p>
                    <p className="text-xs text-foreground/45">Оплачено: {formatMoney(lead.paid_amount)}</p>
                    <p className="text-xs text-foreground/45">Остаток: {formatMoney(lead.balance_due)}</p>
                    <p className="text-xs text-foreground/45">Комиссия: {formatMoney(lead.commission)}</p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {!hasOperator ? (
                      <span className="text-xs text-foreground/35">ТО не выбран</span>
                    ) : !row.operator_current_rate ? (
                      <div className="text-xs text-foreground/45">
                        <p>Курс ТО не задан</p>
                        {row.tour_currency && <p>{row.tour_currency}</p>}
                      </div>
                    ) : (
                      <div className="text-xs">
                        <p className={rateClass(row.operator_rate_direction)}>Сейчас: {formatRate(row.operator_current_rate)} {row.tour_currency}</p>
                        {row.operator_current_rate_date && <p className="text-foreground/40">на {formatDate(row.operator_current_rate_date)}</p>}
                        <p className="text-foreground/45">Оплата: {formatRate(row.payment_exchange_rate)}</p>
                        {row.operator_rate_delta && <p className={rateClass(row.operator_rate_direction)}>Δ {rateDeltaLabel(row.operator_rate_delta)}</p>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className={paymentOverdue ? "font-semibold text-red-600" : "text-foreground/70"}>{formatDateTime(lead.full_payment_due_at)}</span>
                  </td>
                  <td className="px-4 py-3 align-top text-foreground/70">{lead.assigned_manager?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 align-top text-foreground/50">{new Date(lead.created_at).toLocaleDateString("ru-RU")}</td>
                </tr>
              );
            })}
            {!loading && displayedLeads.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-foreground/40">
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
