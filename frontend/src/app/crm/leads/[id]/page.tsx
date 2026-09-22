"use client";

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Paperclip } from "lucide-react";
import {
  addLeadComment,
  createUonRequest,
  getLead,
  listManagers,
  mediaUrl,
  updateLead,
  uploadLeadAttachment,
  STATUS_OPTIONS,
  type CrmUser,
  type LeadDetail,
  type LeadStatus,
} from "@/lib/crmApi";
import { fetchDirections, type Direction } from "@/lib/api";
import { listColumns, type KanbanColumn } from "@/lib/kanbanApi";
import { listTourOperators, type TourOperator } from "@/lib/tourOperatorsApi";
import { useCrmAuth } from "@/components/crm/CrmAuthProvider";
import StatusBadge from "@/components/crm/StatusBadge";
import { getLeadStatusLabel, LeadStatusHint } from "@/components/crm/LeadStatusInfo";
import TaskModal from "@/components/kanban/TaskModal";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type ContactPreferredMethod = "phone" | "whatsapp" | "telegram" | "max" | "vk" | "email" | "other";

type ClientContact = {
  id: number;
  last_name: string;
  first_name: string;
  middle_name: string;
  full_name: string;
  birth_date: string | null;
  email_primary: string;
  email_secondary: string;
  phone_primary: string;
  phone_secondary: string;
  vk_profile: string;
  preferred_contact_method: ContactPreferredMethod;
  preferred_contact_method_display: string;
  allow_email_marketing: boolean;
  allow_messenger_marketing: boolean;
  note: string;
  created_at: string;
  updated_at: string;
};

type LeadExtra = LeadDetail & {
  contact?: number | null;
  contact_details?: ClientContact | null;
  preferred_messenger?: ContactPreferredMethod;
  preferred_messenger_display?: string;
  tour_currency?: string;
  payment_exchange_rate?: string | null;
  tour_operator_ref?: number | null;
  tour_operator_details?: TourOperator | null;
};

type ContactPayload = Partial<Pick<
  ClientContact,
  | "last_name"
  | "first_name"
  | "middle_name"
  | "birth_date"
  | "email_primary"
  | "email_secondary"
  | "phone_primary"
  | "phone_secondary"
  | "vk_profile"
  | "preferred_contact_method"
  | "allow_email_marketing"
  | "allow_messenger_marketing"
  | "note"
>>;

type UpdatePatch = Parameters<typeof updateLead>[1];

const CURRENCY_OPTIONS = [
  { value: "RUB", label: "RUB — рубль" },
  { value: "USD", label: "USD — доллар" },
  { value: "EUR", label: "EUR — евро" },
  { value: "CNY", label: "CNY — юань" },
  { value: "AED", label: "AED — дирхам" },
  { value: "THB", label: "THB — бат" },
  { value: "TRY", label: "TRY — лира" },
  { value: "OTHER", label: "Другая валюта" },
];

const CONTACT_METHOD_OPTIONS: { value: ContactPreferredMethod; label: string }[] = [
  { value: "phone", label: "Телефон" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "max", label: "MAX" },
  { value: "vk", label: "ВК" },
  { value: "email", label: "Email" },
  { value: "other", label: "Другое" },
];

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

async function ensureCsrfCookie() {
  await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
}

async function crmApiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  let csrfToken = getCookie("csrftoken");
  if (!csrfToken) {
    await ensureCsrfCookie();
    csrfToken = getCookie("csrftoken");
  }

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (csrfToken) headers.set("X-CSRFToken", csrfToken);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const fieldErrors = Object.values(data).flat().filter((v): v is string => typeof v === "string");
    throw new Error(data.detail || fieldErrors.join(" ") || "Ошибка запроса");
  }

  return res.json();
}

async function upsertLeadContact(leadId: number, data: ContactPayload): Promise<LeadDetail> {
  return crmApiJson<LeadDetail>(`/api/crm/leads/${leadId}/contact/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

function dateValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function dateTimeValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function isPast(value: string | null) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-xs text-foreground/50">{children}</label>;
}

function inputClass(extra = "") {
  return `mt-1 w-full rounded-lg border border-black/10 px-2 py-1.5 text-sm outline-none focus:border-blue ${extra}`;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 text-xs">
      <dt className="text-foreground/45">{label}</dt>
      <dd className="text-right font-medium text-navy">{value}</dd>
    </div>
  );
}

export default function CrmLeadDetailPage() {
  const params = useParams<{ id: string }>();
  const leadId = Number(params.id);
  const router = useRouter();
  const { user } = useCrmAuth();
  const isHead = user?.is_head ?? false;

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [managers, setManagers] = useState<CrmUser[]>([]);
  const [directions, setDirections] = useState<Direction[]>([]);
  const [tourOperators, setTourOperators] = useState<TourOperator[]>([]);
  const [comment, setComment] = useState("");
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savingContactField, setSavingContactField] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [convertingToRequest, setConvertingToRequest] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const load = useCallback(async () => {
    try {
      setLead(await getLead(leadId));
    } catch {
      setLead(null);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isHead) listManagers().then(setManagers);
  }, [isHead]);

  useEffect(() => {
    fetchDirections().then(setDirections);
    listColumns().then(setColumns);
    listTourOperators().then(setTourOperators).catch(() => setTourOperators([]));
  }, []);

  async function savePatch(data: UpdatePatch, field: string) {
    if (!lead) return;
    setSavingField(field);
    try {
      setLead(await updateLead(lead.id, data));
    } finally {
      setSavingField(null);
    }
  }

  function contactPayload(data: ContactPayload): ContactPayload {
    if (!lead) return data;
    const leadExtra = lead as LeadExtra;
    const current = leadExtra.contact_details;
    return {
      last_name: current?.last_name ?? "",
      first_name: current?.first_name ?? lead.name,
      middle_name: current?.middle_name ?? "",
      birth_date: current?.birth_date ?? null,
      email_primary: current?.email_primary ?? lead.email,
      email_secondary: current?.email_secondary ?? "",
      phone_primary: current?.phone_primary ?? lead.phone,
      phone_secondary: current?.phone_secondary ?? "",
      vk_profile: current?.vk_profile ?? "",
      preferred_contact_method: current?.preferred_contact_method ?? leadExtra.preferred_messenger ?? "phone",
      allow_email_marketing: current?.allow_email_marketing ?? true,
      allow_messenger_marketing: current?.allow_messenger_marketing ?? true,
      note: current?.note ?? "",
      ...data,
    };
  }

  async function saveContactPatch(data: ContactPayload, field: string) {
    if (!lead) return;
    setSavingContactField(field);
    setContactError(null);
    try {
      setLead(await upsertLeadContact(lead.id, contactPayload(data)));
    } catch (err) {
      setContactError(err instanceof Error ? err.message : "Не удалось сохранить клиента");
    } finally {
      setSavingContactField(null);
    }
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!lead || !comment.trim()) return;
    await addLeadComment(lead.id, comment.trim());
    setComment("");
    load();
  }

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    if (!lead || !e.target.files?.length) return;
    await uploadLeadAttachment(lead.id, e.target.files[0]);
    e.target.value = "";
    load();
  }

  async function handleCreateUonRequest() {
    if (!lead) return;
    setConvertingToRequest(true);
    setConvertError(null);
    try {
      setLead(await createUonRequest(lead.id));
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : "Не удалось создать заявку в U-ON");
    } finally {
      setConvertingToRequest(false);
    }
  }

  if (loading) return <p className="text-sm text-foreground/50">Загрузка…</p>;

  if (!lead) {
    return (
      <div>
        <p className="text-sm text-foreground/50">Заявка не найдена или недоступна.</p>
        <button onClick={() => router.push("/crm/leads")} className="mt-3 text-sm text-blue underline">
          Назад к списку
        </button>
      </div>
    );
  }

  const leadExtra = lead as LeadExtra;
  const client = leadExtra.contact_details;
  const clientDefaults = {
    last_name: client?.last_name ?? "",
    first_name: client?.first_name ?? lead.name,
    middle_name: client?.middle_name ?? "",
    birth_date: client?.birth_date ?? null,
    phone_primary: client?.phone_primary ?? lead.phone,
    phone_secondary: client?.phone_secondary ?? "",
    email_primary: client?.email_primary ?? lead.email,
    email_secondary: client?.email_secondary ?? "",
    vk_profile: client?.vk_profile ?? "",
    preferred_contact_method: client?.preferred_contact_method ?? leadExtra.preferred_messenger ?? "phone",
    allow_email_marketing: client?.allow_email_marketing ?? true,
    allow_messenger_marketing: client?.allow_messenger_marketing ?? true,
    note: client?.note ?? "",
  };
  const selectedTourOperator = leadExtra.tour_operator_details ?? tourOperators.find((item) => item.id === leadExtra.tour_operator_ref) ?? null;
  const contactOverdue = isPast(lead.next_contact_at);
  const paymentOverdue = isPast(lead.full_payment_due_at);
  const closedStatuses: LeadStatus[] = ["closed_won", "closed_lost", "failed", "not_target"];
  const isClosedStatus = closedStatuses.includes(lead.status);
  const needsNextContact = ["follow_up", "selection", "options_proposed"].includes(lead.status) && !lead.next_contact_at;
  const needsFailureReason = isClosedStatus && !lead.failure_reason;
  const needsPaymentControl = ["booked", "prepaid", "waiting_payment"].includes(lead.status) && !lead.full_payment_due_at;
  const reasonLabel = lead.status === "failed" ? "Причина провала" : lead.status === "closed_lost" ? "Причина неуспешной заявки" : lead.status === "not_target" ? "Причина нецелевого обращения" : "Причина закрытия";
  const timeline = [
    ...lead.comments.map((c) => ({ kind: "comment" as const, date: c.created_at, data: c })),
    ...lead.status_history.map((h) => ({ kind: "status" as const, date: h.changed_at, data: h })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div>
      <button onClick={() => router.push("/crm/leads")} className="mb-4 flex items-center gap-1 text-sm text-foreground/50 hover:text-navy">
        <ArrowLeft size={15} />
        Все заявки
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <section className="rounded-2xl border border-black/5 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1">
                <input type="text" defaultValue={lead.name} onBlur={(e) => savePatch({ name: e.target.value }, "name")} disabled={savingField === "name"} className="-mx-1 w-full rounded-lg border border-transparent px-1 text-xl font-bold text-navy outline-none hover:border-black/10 focus:border-blue" />
                <div className="mt-1 flex flex-wrap items-center gap-x-1 text-sm text-foreground/60">
                  <input type="tel" defaultValue={lead.phone} onBlur={(e) => savePatch({ phone: e.target.value }, "phone")} className="-mx-1 rounded-lg border border-transparent px-1 outline-none hover:border-black/10 focus:border-blue" />
                  <span>·</span>
                  <input type="email" placeholder="Email" defaultValue={lead.email} onBlur={(e) => savePatch({ email: e.target.value }, "email")} className="-mx-1 rounded-lg border border-transparent px-1 outline-none hover:border-black/10 focus:border-blue" />
                </div>
                <p className="mt-1 text-xs text-foreground/40">Источник: {lead.source_display}</p>
              </div>
              <StatusBadge status={lead.status} label={lead.status_display} />
            </div>

            <div className="mt-4">
              <FieldLabel>Комментарий</FieldLabel>
              <textarea defaultValue={lead.initial_comment} onBlur={(e) => savePatch({ initial_comment: e.target.value }, "initial_comment")} rows={2} placeholder="Комментарий по заявке…" className="mt-1 w-full resize-none rounded-xl bg-blue-light/40 p-3 text-sm text-foreground/70 outline-none focus:ring-1 focus:ring-blue" />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <FieldLabel>Статус</FieldLabel>
                <select value={lead.status} onChange={(e) => savePatch({ status: e.target.value as LeadStatus }, "status")} className={inputClass()}>
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{getLeadStatusLabel(s.value, s.label)}</option>)}
                </select>
                <LeadStatusHint status={lead.status} />
                {needsNextContact && <p className="mt-1 text-xs text-red-600">Для этого статуса нужна дата следующего контакта.</p>}
                {needsPaymentControl && <p className="mt-1 text-xs text-red-600">Для этого статуса нужен дедлайн полной оплаты.</p>}
                {needsFailureReason && <p className="mt-1 text-xs text-red-600">Для закрытия нужна причина.</p>}
              </div>
              <div>
                <FieldLabel>Ответственный</FieldLabel>
                {isHead ? (
                  <select value={lead.assigned_manager?.id ?? ""} onChange={(e) => savePatch({ assigned_manager: Number(e.target.value) }, "manager")} className={inputClass()}>
                    <option value="" disabled>Не назначен</option>
                    {managers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                ) : (
                  <p className="mt-1.5 text-sm text-navy">{lead.assigned_manager?.full_name ?? "—"}</p>
                )}
              </div>
              <div>
                <FieldLabel>Направление</FieldLabel>
                <select value={lead.direction ?? ""} onChange={(e) => savePatch({ direction: e.target.value ? Number(e.target.value) : null }, "direction")} className={inputClass()}>
                  <option value="">Не указано</option>
                  {directions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-black/5 bg-white p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-navy">Клиент</h2>
                <p className="mt-1 text-xs text-foreground/45">Отдельная карточка клиента для контактов и будущих рассылок.</p>
              </div>
              {savingContactField && <span className="text-xs text-foreground/40">Сохранение…</span>}
            </div>
            {contactError && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{contactError}</p>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div><FieldLabel>Фамилия</FieldLabel><input defaultValue={clientDefaults.last_name} onBlur={(e) => saveContactPatch({ last_name: e.target.value }, "last_name")} className={inputClass()} /></div>
              <div><FieldLabel>Имя</FieldLabel><input defaultValue={clientDefaults.first_name} onBlur={(e) => saveContactPatch({ first_name: e.target.value }, "first_name")} className={inputClass()} /></div>
              <div><FieldLabel>Отчество</FieldLabel><input defaultValue={clientDefaults.middle_name} onBlur={(e) => saveContactPatch({ middle_name: e.target.value }, "middle_name")} className={inputClass()} /></div>
              <div><FieldLabel>Дата рождения</FieldLabel><input type="date" defaultValue={dateValue(clientDefaults.birth_date)} onBlur={(e) => saveContactPatch({ birth_date: e.target.value || null }, "birth_date")} className={inputClass()} /></div>
              <div><FieldLabel>Телефон основной</FieldLabel><input type="tel" defaultValue={clientDefaults.phone_primary} onBlur={(e) => saveContactPatch({ phone_primary: e.target.value }, "phone_primary")} className={inputClass()} /></div>
              <div><FieldLabel>Телефон дополнительный</FieldLabel><input type="tel" defaultValue={clientDefaults.phone_secondary} onBlur={(e) => saveContactPatch({ phone_secondary: e.target.value }, "phone_secondary")} className={inputClass()} /></div>
              <div><FieldLabel>Email основной</FieldLabel><input type="email" defaultValue={clientDefaults.email_primary} onBlur={(e) => saveContactPatch({ email_primary: e.target.value }, "email_primary")} className={inputClass()} /></div>
              <div><FieldLabel>Email дополнительный</FieldLabel><input type="email" defaultValue={clientDefaults.email_secondary} onBlur={(e) => saveContactPatch({ email_secondary: e.target.value }, "email_secondary")} className={inputClass()} /></div>
              <div><FieldLabel>ВК</FieldLabel><input defaultValue={clientDefaults.vk_profile} placeholder="ссылка или id" onBlur={(e) => saveContactPatch({ vk_profile: e.target.value }, "vk_profile")} className={inputClass()} /></div>
              <div><FieldLabel>Предпочтительный тип связи</FieldLabel><select defaultValue={clientDefaults.preferred_contact_method} onChange={(e) => saveContactPatch({ preferred_contact_method: e.target.value as ContactPreferredMethod }, "preferred_contact_method")} className={inputClass()}>{CONTACT_METHOD_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
              <label className="mt-5 flex items-center gap-2 text-sm text-foreground/70"><input type="checkbox" defaultChecked={clientDefaults.allow_email_marketing} onChange={(e) => saveContactPatch({ allow_email_marketing: e.target.checked }, "allow_email_marketing")} /> Email-рассылки разрешены</label>
              <label className="mt-5 flex items-center gap-2 text-sm text-foreground/70"><input type="checkbox" defaultChecked={clientDefaults.allow_messenger_marketing} onChange={(e) => saveContactPatch({ allow_messenger_marketing: e.target.checked }, "allow_messenger_marketing")} /> Мессенджер-рассылки разрешены</label>
            </div>
            <div className="mt-4"><FieldLabel>Примечание по клиенту</FieldLabel><textarea defaultValue={clientDefaults.note} onBlur={(e) => saveContactPatch({ note: e.target.value }, "note")} rows={2} className="mt-1 w-full resize-none rounded-xl border border-black/10 p-3 text-sm outline-none focus:border-blue" /></div>
          </section>

          <section className="mt-6 rounded-2xl border border-black/5 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-navy">Параметры тура</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div><FieldLabel>Город вылета</FieldLabel><input defaultValue={lead.departure_city} onBlur={(e) => savePatch({ departure_city: e.target.value }, "departure_city")} className={inputClass()} /></div>
              <div><FieldLabel>Дата вылета</FieldLabel><input type="date" defaultValue={dateValue(lead.departure_date)} onBlur={(e) => savePatch({ departure_date: e.target.value || null }, "departure_date")} className={inputClass()} /></div>
              <div><FieldLabel>Ночей</FieldLabel><input type="number" defaultValue={lead.nights ?? ""} onBlur={(e) => savePatch({ nights: e.target.value ? Number(e.target.value) : null }, "nights")} className={inputClass()} /></div>
              <div><FieldLabel>Взрослых</FieldLabel><input type="number" defaultValue={lead.adults ?? ""} onBlur={(e) => savePatch({ adults: e.target.value ? Number(e.target.value) : null }, "adults")} className={inputClass()} /></div>
              <div><FieldLabel>Детей</FieldLabel><input type="number" defaultValue={lead.children_count ?? ""} onBlur={(e) => savePatch({ children_count: e.target.value ? Number(e.target.value) : null }, "children_count")} className={inputClass()} /></div>
              <div><FieldLabel>Возраст детей</FieldLabel><input defaultValue={lead.children_ages} onBlur={(e) => savePatch({ children_ages: e.target.value }, "children_ages")} placeholder="например: 5 и 11" className={inputClass()} /></div>
              <div><FieldLabel>Бюджет от, ₽</FieldLabel><input type="number" defaultValue={lead.budget_from ?? ""} onBlur={(e) => savePatch({ budget_from: e.target.value || null }, "budget_from")} className={inputClass()} /></div>
              <div><FieldLabel>Бюджет до, ₽</FieldLabel><input type="number" defaultValue={lead.budget_to ?? ""} onBlur={(e) => savePatch({ budget_to: e.target.value || null }, "budget_to")} className={inputClass()} /></div>
              <div><FieldLabel>Питание</FieldLabel><input defaultValue={lead.meal_type} onBlur={(e) => savePatch({ meal_type: e.target.value }, "meal_type")} placeholder="AI, HB, BB" className={inputClass()} /></div>
            </div>
            <div className="mt-4"><FieldLabel>Пожелания по отелю и отдыху</FieldLabel><textarea defaultValue={lead.hotel_wishes} onBlur={(e) => savePatch({ hotel_wishes: e.target.value }, "hotel_wishes")} rows={3} className="mt-1 w-full resize-none rounded-xl border border-black/10 p-3 text-sm outline-none focus:border-blue" /></div>
          </section>

          <section className="mt-6 rounded-2xl border border-black/5 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-navy">Контроль продаж и оплаты</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div><FieldLabel>Следующий контакт</FieldLabel><input type="datetime-local" defaultValue={dateTimeValue(lead.next_contact_at)} onBlur={(e) => savePatch({ next_contact_at: e.target.value || null }, "next_contact_at")} className={inputClass(contactOverdue ? "border-red-400" : "")} />{contactOverdue && <p className="mt-1 text-xs text-red-600">Контакт просрочен</p>}</div>
              <div><FieldLabel>Сумма сделки</FieldLabel><input type="number" defaultValue={lead.deal_amount ?? ""} onBlur={(e) => savePatch({ deal_amount: e.target.value || null }, "deal_amount")} className={inputClass()} /></div>
              <div><FieldLabel>Валюта тура</FieldLabel><select value={leadExtra.tour_currency ?? "RUB"} onChange={(e) => savePatch({ tour_currency: e.target.value } as UpdatePatch, "tour_currency")} className={inputClass()}>{CURRENCY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
              <div><FieldLabel>Курс на момент оплаты</FieldLabel><input type="number" step="0.0001" placeholder="например: 92.5000" defaultValue={leadExtra.payment_exchange_rate ?? ""} onBlur={(e) => savePatch({ payment_exchange_rate: e.target.value || null } as UpdatePatch, "payment_exchange_rate")} className={inputClass()} /></div>
              <div><FieldLabel>Комиссия, ₽</FieldLabel><input type="number" defaultValue={lead.commission ?? ""} onBlur={(e) => savePatch({ commission: e.target.value || null }, "commission")} className={inputClass()} /></div>
              <div><FieldLabel>Предоплата, ₽</FieldLabel><input type="number" defaultValue={lead.prepayment_amount ?? ""} onBlur={(e) => savePatch({ prepayment_amount: e.target.value || null }, "prepayment_amount")} className={inputClass()} /></div>
              <div><FieldLabel>Оплачено туристом, ₽</FieldLabel><input type="number" defaultValue={lead.paid_amount ?? ""} onBlur={(e) => savePatch({ paid_amount: e.target.value || null }, "paid_amount")} className={inputClass()} /></div>
              <div><FieldLabel>Остаток, ₽</FieldLabel><input type="number" defaultValue={lead.balance_due ?? ""} onBlur={(e) => savePatch({ balance_due: e.target.value || null }, "balance_due")} className={inputClass()} /></div>
              <div><FieldLabel>Дедлайн полной оплаты</FieldLabel><input type="datetime-local" defaultValue={dateTimeValue(lead.full_payment_due_at)} onBlur={(e) => savePatch({ full_payment_due_at: e.target.value || null }, "full_payment_due_at")} className={inputClass(paymentOverdue ? "border-red-400" : "")} />{paymentOverdue && <p className="mt-1 text-xs text-red-600">Оплата просрочена</p>}</div>
              <div><FieldLabel>Туроператор из справочника</FieldLabel><select value={leadExtra.tour_operator_ref ?? ""} onChange={(e) => savePatch({ tour_operator_ref: e.target.value ? Number(e.target.value) : null } as UpdatePatch, "tour_operator_ref")} className={inputClass()}><option value="">Не выбран</option>{tourOperators.map((operator) => <option key={operator.id} value={operator.id}>{operator.brand_name}</option>)}</select></div>
              <div><FieldLabel>Туроператор текстом</FieldLabel><input defaultValue={lead.tour_operator} onBlur={(e) => savePatch({ tour_operator: e.target.value }, "tour_operator")} className={inputClass()} /></div>
              <div><FieldLabel>Номер брони</FieldLabel><input defaultValue={lead.booking_number} onBlur={(e) => savePatch({ booking_number: e.target.value }, "booking_number")} className={inputClass()} /></div>
            </div>

            {selectedTourOperator && (
              <div className="mt-4 rounded-2xl bg-blue-light/35 p-4">
                <div className="mb-2 flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-navy">{selectedTourOperator.brand_name}</p>{selectedTourOperator.legal_name && <p className="mt-1 text-xs text-foreground/60">{selectedTourOperator.legal_name}</p>}</div>{selectedTourOperator.website && <a href={selectedTourOperator.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue hover:underline">сайт <ExternalLink size={12} /></a>}</div>
                <dl className="grid gap-1 sm:grid-cols-2"><InfoRow label="ИНН" value={selectedTourOperator.inn} /><InfoRow label="ОГРН" value={selectedTourOperator.ogrn} /><InfoRow label="Реестр" value={selectedTourOperator.registry_number} /><InfoRow label="Сфера" value={selectedTourOperator.activity_scope} /><InfoRow label="Телефон" value={selectedTourOperator.phone} /><InfoRow label="Email" value={selectedTourOperator.email} /></dl>
                {selectedTourOperator.payment_details && <p className="mt-3 whitespace-pre-line text-xs text-foreground/65">{selectedTourOperator.payment_details}</p>}
                {selectedTourOperator.note && <p className="mt-3 text-xs text-foreground/45">{selectedTourOperator.note}</p>}
              </div>
            )}

            {isClosedStatus && <div className="mt-4"><FieldLabel>{reasonLabel}</FieldLabel><textarea defaultValue={lead.failure_reason} onBlur={(e) => savePatch({ failure_reason: e.target.value }, "failure_reason")} rows={2} className="mt-1 w-full resize-none rounded-xl border border-black/10 p-3 text-sm outline-none focus:border-blue" />{!lead.failure_reason && <p className="mt-1 text-xs text-red-600">Для закрытия нужна причина.</p>}</div>}
          </section>

          <section className="mt-6 rounded-2xl border border-black/5 bg-white p-6">
            <h2 className="mb-3 text-sm font-semibold text-navy">История</h2>
            <form onSubmit={handleAddComment} className="mb-4 flex gap-2"><input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Добавить комментарий…" className="flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue" /><button type="submit" className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-blue">Добавить</button></form>
            <div className="flex flex-col gap-3">{timeline.map((item) => <div key={`${item.kind}-${item.data.id}`} className="rounded-xl bg-blue-light/30 p-3 text-sm">{item.kind === "comment" ? <p className="text-foreground/80">{item.data.text}</p> : <p className="text-foreground/80">Статус изменён: <span className="font-medium">{item.data.old_status_display || "—"} → {item.data.new_status_display}</span></p>}<p className="mt-1 text-xs text-foreground/40">{"author" in item.data ? item.data.author?.full_name : item.data.changed_by?.full_name}{" · "}{new Date(item.date).toLocaleString("ru-RU")}</p></div>)}{timeline.length === 0 && <p className="text-sm text-foreground/40">Пока нет ни комментариев, ни изменений статуса.</p>}</div>
          </section>
        </div>

        <div>
          <section className="rounded-2xl border border-black/5 bg-white p-6"><h2 className="mb-3 text-sm font-semibold text-navy">Файлы</h2><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-black/15 px-3 py-2.5 text-sm text-foreground/60 hover:border-blue hover:text-blue"><Paperclip size={15} />Прикрепить файл<input type="file" className="hidden" onChange={handleFileUpload} /></label><ul className="mt-3 flex flex-col gap-2">{lead.attachments.map((a) => <li key={a.id}><a href={mediaUrl(a.file)} target="_blank" rel="noopener noreferrer" className="text-sm text-blue underline underline-offset-2 hover:text-navy">{a.file.split("/").pop()}</a></li>)}{lead.attachments.length === 0 && <p className="text-xs text-foreground/40">Файлов пока нет</p>}</ul></section>

          <section className="mt-6 rounded-2xl border border-black/5 bg-white p-6"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-navy">Связанные задачи</h2><button onClick={() => setShowTaskModal(true)} className="text-xs font-semibold text-blue hover:underline">+ Создать задачу</button></div><ul className="flex flex-col gap-2">{lead.tasks.map((t) => <li key={t.id}><Link href={`/crm/kanban?task=${t.id}`} className="block rounded-xl bg-blue-light/30 p-3 text-sm transition-colors hover:bg-blue-light"><p className="font-medium text-navy">{t.title}</p><p className="text-xs text-foreground/50">{t.column}{t.deadline && <> · до {new Date(t.deadline).toLocaleDateString("ru-RU")}</>}</p></Link></li>)}{lead.tasks.length === 0 && <p className="text-xs text-foreground/40">Задач на канбан-доске пока нет</p>}</ul></section>

          {lead.uon_lead && <section className="mt-6 rounded-2xl border border-black/5 bg-white p-6"><h2 className="mb-3 text-sm font-semibold text-navy">Обращение в U-ON</h2><dl className="flex flex-col gap-2 text-sm"><div className="flex justify-between gap-2"><dt className="text-foreground/50">Статус</dt><dd className="font-medium text-navy">{lead.uon_lead.status_name || "—"}</dd></div><div className="flex justify-between gap-2"><dt className="text-foreground/50">Менеджер</dt><dd className="text-navy">{lead.uon_lead.manager_name || "—"}</dd></div><div className="flex justify-between gap-2"><dt className="text-foreground/50">Источник</dt><dd className="text-navy">{lead.uon_lead.source_name || "—"}</dd></div></dl><p className="mt-3 text-xs text-foreground/40">Обновлено: {new Date(lead.uon_lead.synced_at).toLocaleString("ru-RU")}</p></section>}

          <section className="mt-6 rounded-2xl border border-black/5 bg-white p-6"><h2 className="mb-3 text-sm font-semibold text-navy">Заявка в U-ON</h2>{lead.uon_request_id ? <><p className="text-sm text-navy">ID заявки: {lead.uon_request_id}</p>{lead.uon_request && <dl className="mt-2 flex flex-col gap-2 text-sm"><div className="flex justify-between gap-2"><dt className="text-foreground/50">Статус</dt><dd className="font-medium text-navy">{lead.uon_request.status_name || "—"}</dd></div><div className="flex justify-between gap-2"><dt className="text-foreground/50">Менеджер</dt><dd className="text-navy">{lead.uon_request.manager_name || "—"}</dd></div><div className="flex justify-between gap-2"><dt className="text-foreground/50">Номер брони</dt><dd className="text-navy">{lead.uon_request.reservation_number || "—"}</dd></div></dl>}<Link href={`/crm/uon-requests?uon_id=${lead.uon_request_id}`} className="mt-3 inline-block text-sm text-blue underline underline-offset-2 hover:text-navy">Открыть и редактировать в «Заявки U-ON»</Link></> : <><p className="text-sm leading-6 text-foreground/50">Первичное обращение в U-ON создаётся автоматически. Эту кнопку нажимайте только когда клиент выбрал тур или готов перейти к бронированию.</p><button onClick={handleCreateUonRequest} disabled={convertingToRequest} className="mt-3 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-blue disabled:opacity-50">{convertingToRequest ? "Создание…" : "Перевести в заявку U-ON"}</button>{convertError && <p className="mt-2 text-xs text-red-600">{convertError}</p>}</>}</section>

          <section className="mt-6 rounded-2xl border border-black/5 bg-white p-6"><h2 className="mb-3 text-sm font-semibold text-navy">Синхронизация с U-ON</h2><ul className="flex flex-col gap-2">{lead.uon_sync_logs.map((log) => <li key={log.id} className="rounded-xl bg-blue-light/30 p-3 text-sm"><p className="font-medium text-navy">Попытка {log.attempt_number} — {log.status_display}</p>{log.error_message && <p className="mt-0.5 text-xs text-red-600">{log.error_message}</p>}<p className="mt-1 text-xs text-foreground/40">{new Date(log.created_at).toLocaleString("ru-RU")}</p></li>)}{lead.uon_sync_logs.length === 0 && <p className="text-xs text-foreground/40">Попыток синхронизации ещё не было</p>}</ul></section>
        </div>
      </div>

      {showTaskModal && <TaskModal columns={columns} defaultColumnId={columns[0]?.id ?? null} task={null} presetLead={{ id: lead.id, name: lead.name }} onClose={() => setShowTaskModal(false)} onSaved={() => { setShowTaskModal(false); load(); }} />}
    </div>
  );
}
