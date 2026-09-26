"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Mail, MessageCircle, Phone, Send, X } from "lucide-react";
import {
  seaPhotoUrl,
  type SeaContact,
  type SeaHotelSummary,
  type SeaPerkGroup,
  type SeaPhoto,
  type SeaSeasonality,
} from "@/lib/seaKbApi";

export function toList(value: string[] | string | undefined | null): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function NeedsCheck({ items, className = "" }: { items?: string[] | string | null; className?: string }) {
  const list = toList(items);
  if (list.length === 0) return null;
  return (
    <div className={`rounded-xl border border-amber-300 bg-amber-50 p-3 ${className}`}>
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-800">
        <AlertTriangle size={13} /> Уточнить
      </p>
      <ul className="mt-1.5 flex flex-col gap-1 text-sm text-amber-900">
        {list.map((t, i) => (
          <li key={i}>• {t}</li>
        ))}
      </ul>
    </div>
  );
}

export function NeedsCheckPill({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
      <AlertTriangle size={11} /> Уточнить
    </span>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-black/5 bg-white p-5 ${className}`}>
      {title && <h2 className="mb-3 text-sm font-semibold text-navy">{title}</h2>}
      {children}
    </section>
  );
}

export function Bullets({ items, tone = "default" }: { items?: string[] | null; tone?: "default" | "pro" | "con" }) {
  if (!items || items.length === 0) return null;
  const mark = tone === "pro" ? "text-green-600" : tone === "con" ? "text-red-500" : "text-gold";
  const sign = tone === "pro" ? "+" : tone === "con" ? "−" : "•";
  return (
    <ul className="flex flex-col gap-1.5 text-sm leading-relaxed text-foreground/80">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className={`shrink-0 font-bold ${mark}`}>{sign}</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function Text({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/40">{label}</p>
      <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-foreground/80">{value}</p>
    </div>
  );
}

export function Stars({ value }: { value: number | null | undefined }) {
  if (!value) return null;
  return <span className="text-gold">{"★".repeat(Math.round(value))}</span>;
}

export function Loading({ error }: { error?: string | null }) {
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  return <p className="text-sm text-foreground/50">Загрузка…</p>;
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-foreground/50">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span>/</span>}
          {it.href ? (
            <Link href={it.href} className="text-blue hover:underline">
              {it.label}
            </Link>
          ) : (
            <span className="text-foreground/70">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

const SEASON: Record<string, { label: string; cls: string }> = {
  best: { label: "Лучший сезон", cls: "bg-green-500 text-white" },
  good: { label: "Хороший", cls: "bg-lime-300 text-lime-950" },
  hot: { label: "Жарко", cls: "bg-orange-400 text-white" },
  mixed: { label: "Переменно", cls: "bg-yellow-200 text-yellow-900" },
  rain: { label: "Дожди", cls: "bg-blue-500 text-white" },
  cool: { label: "Прохладно", cls: "bg-sky-200 text-sky-900" },
};
const MONTHS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

export function SeasonTable({ seasonality, showLegend = true }: { seasonality?: SeaSeasonality | null; showLegend?: boolean }) {
  if (!seasonality || !seasonality.months?.length) return null;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] table-fixed border-separate border-spacing-1 text-center text-[11px]">
          <thead>
            <tr>
              {MONTHS.map((m) => (
                <th key={m} className="font-semibold text-foreground/50">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {MONTHS.map((m, i) => {
                const code = seasonality.months[i];
                const s = SEASON[code];
                return (
                  <td
                    key={m}
                    title={s?.label ?? code}
                    className={`rounded-md py-2 font-semibold ${s?.cls ?? "bg-black/5 text-foreground/40"}`}
                  >
                    {s ? s.label.split(" ")[0].slice(0, 6) : "—"}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      {showLegend && (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          {Object.entries(SEASON).map(([code, s]) => (
            <span key={code} className="flex items-center gap-1 text-foreground/60">
              <span className={`inline-block h-3 w-3 rounded ${s.cls.split(" ")[0]}`} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      {seasonality.note && <p className="mt-2 text-sm leading-relaxed text-foreground/70">{seasonality.note}</p>}
      {seasonality.source && <p className="mt-1 text-[11px] text-foreground/40">Источник: {seasonality.source}</p>}
    </div>
  );
}

export function PhotoGallery({ photos }: { photos?: SeaPhoto[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!photos || photos.length === 0) return null;
  const current = open !== null ? photos[open] : null;
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p, i) => (
          <button
            key={p.file}
            type="button"
            onClick={() => setOpen(i)}
            className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-blue-light"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- фото из медиатеки бэкенда */}
            <img src={seaPhotoUrl(p.file)} alt={p.caption} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
            {p.is_render && (
              <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                Визуализация
              </span>
            )}
          </button>
        ))}
      </div>
      {current && open !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(null)}>
          <button type="button" aria-label="Закрыть" className="absolute right-4 top-4 text-white" onClick={() => setOpen(null)}>
            <X size={26} />
          </button>
          <div className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={seaPhotoUrl(current.file)} alt={current.caption} className="max-h-[80vh] rounded-xl object-contain" />
            <p className="mt-2 text-center text-sm text-white">
              {current.is_render && <span className="mr-2 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">Визуализация</span>}
              {current.caption}
              <span className="ml-3 text-white/50">
                {open + 1} / {photos.length}
              </span>
            </p>
            <div className="mt-2 flex justify-center gap-3">
              <button type="button" className="rounded-full bg-white/20 px-4 py-1.5 text-sm text-white" onClick={() => setOpen((open - 1 + photos.length) % photos.length)}>
                ← Назад
              </button>
              <button type="button" className="rounded-full bg-white/20 px-4 py-1.5 text-sm text-white" onClick={() => setOpen((open + 1) % photos.length)}>
                Вперёд →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ContactCard({ contact }: { contact: SeaContact }) {
  const links = toList(contact.other_links);
  return (
    <div className="rounded-xl border border-black/5 bg-cream p-4">
      <p className="text-sm font-semibold text-navy">{contact.name}</p>
      <p className="text-xs text-foreground/60">{[contact.role, contact.company].filter(Boolean).join(" · ")}</p>
      {contact.represents && contact.represents.length > 0 && (
        <p className="mt-1 text-xs text-foreground/60">Представляет: {contact.represents.join("; ")}</p>
      )}
      <div className="mt-2 flex flex-col gap-1 text-sm text-foreground/80">
        {contact.phone && (
          <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`} className="flex items-center gap-1.5 hover:text-blue">
            <Phone size={13} /> {contact.phone}
          </a>
        )}
        {contact.whatsapp && (
          <span className="flex items-center gap-1.5">
            <MessageCircle size={13} /> WhatsApp: {contact.whatsapp}
          </span>
        )}
        {contact.telegram && (
          <span className="flex items-center gap-1.5">
            <Send size={13} /> Telegram: {contact.telegram}
          </span>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 hover:text-blue">
            <Mail size={13} /> {contact.email}
          </a>
        )}
        {links.map((l, i) => (
          <span key={i} className="text-xs text-foreground/60">
            {l}
          </span>
        ))}
      </div>
      {contact.notes && <p className="mt-2 text-xs leading-relaxed text-foreground/60">{contact.notes}</p>}
      <NeedsCheck items={contact.needs_check} className="mt-2" />
    </div>
  );
}

const PERK_TYPES: Record<string, string> = {
  incentive: "Гарантированные бонусы",
  loyalty: "Лояльность",
  commission: "Комиссия",
  agent_rates: "Агентские тарифы",
  day_pass: "Day pass",
  inspection: "Инспекция",
  fam_trip: "Рекламный тур",
  materials: "Материалы",
  training: "Обучение",
  client_bonus: "Бонусы туристам",
  service: "Сервис",
};

export function PerkGroupView({ group, showHotels = true }: { group: SeaPerkGroup; showHotels?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {group.applies_to && <p className="text-sm text-foreground/70">Распространяется на: {group.applies_to}</p>}
      {group.perks.map((p, i) => (
        <div key={i} className="rounded-xl border border-black/5 bg-cream p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-semibold text-gold-dark">
              {PERK_TYPES[p.type] ?? p.type}
            </span>
            <p className="text-sm font-semibold text-navy">{p.title}</p>
          </div>
          {p.description && <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/80">{p.description}</p>}
          {p.conditions && <Text label="Условия" value={p.conditions} />}
          {p.how_to_get && <Text label="Как получить" value={p.how_to_get} />}
          {p.valid_until && <p className="mt-1 text-xs text-foreground/50">Действует до: {p.valid_until}</p>}
        </div>
      ))}
      <NeedsCheck items={group.needs_check} />
      {group.contact_objects.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">Контакты</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {group.contact_objects.map((c) => (
              <ContactCard key={c.id} contact={c} />
            ))}
          </div>
        </div>
      )}
      {showHotels && group.hotels.length > 0 && (
        <p className="text-xs text-foreground/60">
          Отели в базе:{" "}
          {group.hotels.map((h, i) => (
            <span key={h.id}>
              {i > 0 && ", "}
              <Link href={`/crm/kb/sea/hotels/${h.id}`} className="text-blue hover:underline">
                {h.name}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

export function HotelCard({ hotel }: { hotel: SeaHotelSummary }) {
  return (
    <Link
      href={`/crm/kb/sea/hotels/${hotel.id}`}
      className="flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] bg-blue-light">
        {hotel.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={seaPhotoUrl(hotel.photo)} alt={hotel.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-foreground/30">Нет фото</div>
        )}
        {hotel.status && hotel.status !== "open" && (
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
            {hotel.status === "soft_opening" ? "Софт-опенинг" : hotel.status === "opening_soon" ? "Скоро открытие" : hotel.status}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
          {hotel.country_name} · {hotel.destination_name}
        </p>
        <h3 className="text-base font-bold leading-tight text-navy">
          {hotel.name} <Stars value={hotel.stars} />
        </h3>
        {hotel.brand && <p className="text-xs text-foreground/50">{hotel.brand}</p>}
        {hotel.positioning && <p className="line-clamp-3 text-xs leading-relaxed text-foreground/70">{hotel.positioning}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
          <NeedsCheckPill count={hotel.needs_check_count} />
          {hotel.detail_level === "brief" && (
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-foreground/50">Краткая карточка</span>
          )}
        </div>
      </div>
    </Link>
  );
}
