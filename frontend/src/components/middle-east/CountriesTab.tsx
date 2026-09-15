"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Country } from "@/lib/mideastApi";

function TextBlock({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-black/5 bg-cream p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground/40">{label}</p>
      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/80">{value}</p>
    </div>
  );
}

function BulletList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">{label}</p>
      <ul className="flex flex-col gap-1.5 text-sm text-foreground/80">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-gold">•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CountriesTab({ countries }: { countries: Country[] }) {
  const [openId, setOpenId] = useState<number | null>(countries[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-4">
      {countries.map((c) => {
        const isOpen = openId === c.id;
        return (
          <div key={c.id} className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : c.id)}
              className="flex w-full items-center justify-between gap-4 p-5 text-left"
            >
              <div>
                <h2 className="text-xl font-bold text-navy">{c.name}</h2>
                {c.capital && <p className="mt-1 line-clamp-1 text-xs text-foreground/50">{c.capital}</p>}
              </div>
              <ChevronDown size={20} className={`shrink-0 text-navy/60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
              <div className="flex flex-col gap-5 border-t border-black/5 p-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextBlock label="Столица" value={c.capital} />
                  <TextBlock label="Виза" value={c.visa} />
                  <TextBlock label="Валюта" value={c.currency} />
                  <TextBlock label="Язык" value={c.language} />
                  <TextBlock label="Перелёт" value={c.flight} />
                  <TextBlock label="Сезонность" value={c.season} />
                  <TextBlock label="Алкоголь" value={c.alcohol} />
                  <TextBlock label="Дресс-код" value={c.dress_code} />
                  <TextBlock label="Транспорт" value={c.transport} />
                  <TextBlock label="Безопасность" value={c.safety} />
                  <TextBlock label="География" value={c.geography} />
                </div>

                {c.emirates.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">
                      Эмираты / регионы
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {c.emirates.map((e, i) => (
                        <div key={i} className="rounded-xl border border-black/5 bg-blue-light/40 p-3">
                          <p className="text-sm font-semibold text-navy">{e.name}</p>
                          <p className="mt-1 text-xs leading-relaxed text-foreground/70">{e.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {c.highlights.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">
                      Главные объекты
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {c.highlights.map((h, i) => (
                        <div key={i} className="rounded-xl border border-black/5 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-navy">{h.name}</p>
                            {h.type && (
                              <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold-dark">
                                {h.type}
                              </span>
                            )}
                          </div>
                          {h.emirate && <p className="mt-0.5 text-[11px] text-foreground/40">{h.emirate}</p>}
                          <p className="mt-1 text-xs leading-relaxed text-foreground/70">{h.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {c.events.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">События</p>
                    <div className="flex flex-col gap-2">
                      {c.events.map((e, i) => (
                        <div key={i} className="rounded-xl border border-black/5 p-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-sm font-semibold text-navy">{e.name}</p>
                            {e.when && <span className="text-xs font-medium text-blue">{e.when}</span>}
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-foreground/70">{e.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {c.activities.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">Активности</p>
                    <div className="flex flex-col gap-2">
                      {c.activities.map((a, i) => (
                        <div key={i} className="rounded-xl border border-black/5 p-3">
                          <p className="text-sm font-semibold text-navy">{a.name}</p>
                          <p className="mt-1 text-xs leading-relaxed text-foreground/70">{a.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                  <BulletList label="Акценты продаж" items={c.selling_points} />
                  <BulletList label="Новости" items={c.news} />
                  <BulletList label="Практическая информация" items={c.practical} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
