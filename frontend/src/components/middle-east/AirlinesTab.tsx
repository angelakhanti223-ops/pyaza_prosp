"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Airline } from "@/lib/mideastApi";

function TextBlock({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-black/5 bg-cream p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground/40">{label}</p>
      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/80">{value}</p>
    </div>
  );
}

export default function AirlinesTab({ airlines }: { airlines: Airline[] }) {
  const [openId, setOpenId] = useState<number | null>(airlines[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-4">
      {airlines.map((a) => {
        const isOpen = openId === a.id;
        return (
          <div key={a.id} className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : a.id)}
              className="flex w-full items-center justify-between gap-4 p-5 text-left"
            >
              <div>
                <h2 className="text-xl font-bold text-navy">{a.name}</h2>
                {a.country && <p className="mt-1 text-xs text-foreground/50">{a.country}</p>}
              </div>
              <ChevronDown size={20} className={`shrink-0 text-navy/60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
              <div className="flex flex-col gap-3 border-t border-black/5 p-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextBlock label="Хаб" value={a.hub} />
                  <TextBlock label="Маршруты из России" value={a.routes_from_russia} />
                  <TextBlock label="Сеть направлений" value={a.network} />
                  <TextBlock label="Флот" value={a.fleet} />
                  <TextBlock label="Классы обслуживания" value={a.classes} />
                  <TextBlock label="Багаж" value={a.baggage} />
                  <TextBlock label="Программа лояльности" value={a.loyalty} />
                  <TextBlock label="Стоповер" value={a.stopover} />
                  <TextBlock label="Бизнес-залы" value={a.lounges} />
                  <TextBlock label="На борту" value={a.onboard} />
                </div>

                {a.notes.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">Заметки</p>
                    <ul className="flex flex-col gap-1.5 text-sm text-foreground/80">
                      {a.notes.map((n, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-gold">•</span>
                          {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
