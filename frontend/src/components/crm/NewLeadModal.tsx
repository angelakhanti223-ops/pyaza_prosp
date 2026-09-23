"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { fetchDirections, type Direction } from "@/lib/api";
import { createLead, listManagers, type CrmUser, type LeadDetail } from "@/lib/crmApi";

type Props = {
  onClose: () => void;
  onCreated: (lead: LeadDetail) => void;
};

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "phone_call", label: "Телефонный звонок" },
  { value: "site_form", label: "Сайт / форма" },
  { value: "sletat", label: "Слетать.ру" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "vk", label: "ВК" },
  { value: "max", label: "MAX" },
  { value: "office", label: "Офис / личное обращение" },
  { value: "referral", label: "Рекомендация" },
  { value: "repeat", label: "Повторный клиент" },
  { value: "instagram", label: "Instagram" },
  { value: "uon", label: "U-ON" },
  { value: "chatbot", label: "Чат-бот" },
  { value: "other", label: "Другое" },
];

export default function NewLeadModal({ onClose, onCreated }: Props) {
  const [directions, setDirections] = useState<Direction[]>([]);
  const [managers, setManagers] = useState<CrmUser[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [directionId, setDirectionId] = useState("");
  const [source, setSource] = useState("phone_call");
  const [assignedManagerId, setAssignedManagerId] = useState("");
  const [comment, setComment] = useState("");
  const [departureCity, setDepartureCity] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [nights, setNights] = useState("");
  const [adults, setAdults] = useState("");
  const [childrenCount, setChildrenCount] = useState("");
  const [budgetTo, setBudgetTo] = useState("");
  const [nextContactAt, setNextContactAt] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDirections().then(setDirections);
    listManagers().then(setManagers).catch(() => setManagers([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const lead = await createLead({
        name,
        phone,
        email: email || undefined,
        direction: directionId ? Number(directionId) : undefined,
        initial_comment: comment || undefined,
        source,
        assigned_manager: assignedManagerId ? Number(assignedManagerId) : undefined,
        departure_city: departureCity || undefined,
        departure_date: departureDate || undefined,
        nights: nights ? Number(nights) : undefined,
        adults: adults ? Number(adults) : undefined,
        children_count: childrenCount ? Number(childrenCount) : undefined,
        budget_to: budgetTo || undefined,
        next_contact_at: nextContactAt || undefined,
        consent,
      });
      onCreated(lead);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Не удалось создать обращение");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-dark/60 p-4" onClick={onClose}>
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white p-6 shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-4 top-4 text-foreground/40 transition-colors hover:text-foreground"
        >
          <X size={22} />
        </button>
        <h3 className="mb-1 text-xl font-bold text-navy">Новое обращение</h3>
        <p className="mb-5 text-sm text-foreground/60">
          Со звонка или личного контакта — заявка автоматически уйдёт в U-ON и получит связанную задачу.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input required type="text" placeholder="Имя клиента" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue" />
            <input required type="tel" placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue" />
            <input type="email" placeholder="Email (необязательно)" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue" />
            <select value={directionId} onChange={(e) => setDirectionId(e.target.value)} className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue">
              <option value="">Направление / тип тура</option>
              {directions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue">
              {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={assignedManagerId} onChange={(e) => setAssignedManagerId(e.target.value)} className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue">
              <option value="">Ответственный — я сама</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>

          <div className="mt-2 rounded-2xl bg-blue-light/40 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-blue">Параметры тура</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input placeholder="Город вылета" value={departureCity} onChange={(e) => setDepartureCity(e.target.value)} className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue" />
              <input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue" />
              <input type="number" placeholder="Ночей" value={nights} onChange={(e) => setNights(e.target.value)} className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue" />
              <input type="number" placeholder="Взрослых" value={adults} onChange={(e) => setAdults(e.target.value)} className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue" />
              <input type="number" placeholder="Детей" value={childrenCount} onChange={(e) => setChildrenCount(e.target.value)} className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue" />
              <input type="number" placeholder="Бюджет до, ₽" value={budgetTo} onChange={(e) => setBudgetTo(e.target.value)} className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-foreground/50">Следующий контакт</label>
            <input type="datetime-local" value={nextContactAt} onChange={(e) => setNextContactAt(e.target.value)} className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue" />
          </div>

          <textarea placeholder="Комментарий (необязательно)" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="w-full resize-none rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue" />

          <label className="flex items-start gap-2 text-xs text-foreground/70">
            <input required type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            <span>Согласие клиента на обработку персональных данных получено</span>
          </label>
          {status === "error" && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={status === "submitting"} className="mt-1 rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue disabled:opacity-60">
            {status === "submitting" ? "Создаём…" : "Создать обращение"}
          </button>
        </form>
      </div>
    </div>
  );
}
