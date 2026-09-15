"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Heart, MapPin, Search, X } from "lucide-react";
import type { Hotel } from "@/lib/mideastApi";
import { mediaUrl } from "@/lib/articlesApi";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";

const FAVORITES_KEY = "mideast-favorite-hotels";
const favoritesListeners = new Set<() => void>();

// localStorage — «внешнее хранилище» по терминологии React (не React-состояние),
// поэтому синхронизация через useSyncExternalStore, а не useEffect+setState: это
// заодно безопасно относительно SSR (getServerSnapshot возвращает пустой список,
// без расхождения с первым клиентским рендером — решение по итогам ревью, 15.09.2026).
function subscribeFavorites(callback: () => void) {
  favoritesListeners.add(callback);
  return () => favoritesListeners.delete(callback);
}

function getFavoritesSnapshot(): string {
  try {
    return localStorage.getItem(FAVORITES_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function getFavoritesServerSnapshot(): string {
  return "[]";
}

function useFavorites() {
  const raw = useSyncExternalStore(subscribeFavorites, getFavoritesSnapshot, getFavoritesServerSnapshot);
  const favorites = useMemo(() => {
    try {
      return new Set<number>(JSON.parse(raw));
    } catch {
      return new Set<number>();
    }
  }, [raw]);

  function toggle(id: number) {
    const next = new Set(favorites);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
    } catch {
      // localStorage недоступен (приватное окно и т.п.) — избранное просто не сохранится.
    }
    favoritesListeners.forEach((listener) => listener());
  }

  return { favorites, toggle };
}

const FLAG_FILTERS: { key: keyof Hotel; label: string }[] = [
  { key: "f_all_inclusive", label: "Всё включено" },
  { key: "f_beach", label: "Пляж" },
  { key: "f_kids_friendly", label: "Детям" },
  { key: "f_spa", label: "Спа" },
  { key: "f_russian_staff", label: "Рус. персонал" },
];

export default function HotelsTab({ hotels }: { hotels: Hotel[] }) {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [activeFlags, setActiveFlags] = useState<Set<string>>(new Set());
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [selected, setSelected] = useState<Hotel | null>(null);
  const { favorites, toggle } = useFavorites();

  const countries = useMemo(() => [...new Set(hotels.map((h) => h.country))].sort(), [hotels]);

  function toggleFlag(key: string) {
    setActiveFlags((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const filtered = hotels.filter((h) => {
    if (country && h.country !== country) return false;
    if (onlyFavorites && !favorites.has(h.id)) return false;
    for (const key of activeFlags) {
      if (!h[key as keyof Hotel]) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const haystack = `${h.name} ${h.brand} ${h.region} ${h.location}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[220px]">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию, бренду, локации"
            className="w-full rounded-xl border border-black/10 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue"
          />
        </div>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-blue"
        >
          <option value="">Все страны</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          {FLAG_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => toggleFlag(f.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeFlags.has(f.key)
                  ? "border-navy bg-navy text-white"
                  : "border-black/10 text-foreground/60 hover:border-navy/30"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOnlyFavorites((v) => !v)}
            className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              onlyFavorites ? "border-gold bg-gold/15 text-navy" : "border-black/10 text-foreground/60 hover:border-navy/30"
            }`}
          >
            <Heart size={13} className={onlyFavorites ? "fill-gold text-gold" : ""} />
            Избранное
          </button>
        </div>
      </div>

      <p className="mt-4 text-xs text-foreground/50">Найдено отелей: {filtered.length}</p>

      <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((hotel) => (
          <HotelCard
            key={hotel.id}
            hotel={hotel}
            isFavorite={favorites.has(hotel.id)}
            onToggleFavorite={() => toggle(hotel.id)}
            onOpen={() => setSelected(hotel)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-foreground/40">
            Ничего не нашлось — попробуйте снять часть фильтров.
          </p>
        )}
      </div>

      {selected && <HotelModal hotel={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function HotelCard({
  hotel,
  isFavorite,
  onToggleFavorite,
  onOpen,
}: {
  hotel: Hotel;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOpen: () => void;
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] bg-blue-light">
        {hotel.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- внешние фото из медиатеки бэкенда, next/image здесь не нужен
          <img src={mediaUrl(hotel.photo) ?? undefined} alt={hotel.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-foreground/30">Нет фото</div>
        )}
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={isFavorite ? "Убрать из избранного" : "Добавить в избранное"}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm"
        >
          <Heart size={15} className={isFavorite ? "fill-red-500 text-red-500" : "text-foreground/50"} />
        </button>
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-navy-dark/80 to-transparent px-3 py-2 text-[11px] font-medium text-white">
          <MapPin size={11} />
          {hotel.country}
          {hotel.region ? ` · ${hotel.region}` : ""}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        {hotel.category && <p className="text-[11px] font-semibold uppercase tracking-wide text-gold">{hotel.category}</p>}
        <h3 className="mt-1 text-base font-bold leading-tight text-navy">{hotel.name}</h3>
        {hotel.brand && <p className="mt-0.5 text-xs text-foreground/50">{hotel.brand}</p>}
        {hotel.usp.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-xs text-foreground/70">
            {hotel.usp.slice(0, 2).map((point, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-gold">•</span>
                {point}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onOpen}
          className="mt-auto flex items-center justify-between gap-2 border-t border-black/5 pt-3 text-sm font-semibold text-blue"
        >
          Подробнее <span aria-hidden>→</span>
        </button>
      </div>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-black/5 bg-cream p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/40">{label}</p>
      <p className="mt-1 text-sm text-foreground/80">{value}</p>
    </div>
  );
}

function HotelModal({ hotel, onClose }: { hotel: Hotel; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-dark/60 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-xl"
      >
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-foreground/60 shadow-sm hover:text-foreground"
        >
          <X size={18} />
        </button>

        {hotel.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(hotel.photo) ?? undefined} alt={hotel.name} className="h-56 w-full object-cover" />
        )}

        <div className="p-6">
          {hotel.category && <p className="text-xs font-semibold uppercase tracking-wide text-gold">{hotel.category}</p>}
          <h2 className="mt-1 text-2xl font-bold text-navy">{hotel.name}</h2>
          <p className="mt-1 text-sm text-foreground/60">
            {hotel.brand ? `${hotel.brand} · ` : ""}
            {hotel.country}
            {hotel.region ? ` · ${hotel.region}` : ""}
          </p>

          {hotel.status && (
            <p className="mt-4 rounded-xl bg-blue-light/60 p-3 text-sm text-navy">{hotel.status}</p>
          )}

          {hotel.usp.length > 0 && (
            <div className="mt-4 rounded-xl bg-gold/10 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy">Фишки</p>
              <ul className="flex flex-col gap-1.5 text-sm text-foreground/80">
                {hotel.usp.map((point, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-gold">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Номерной фонд" value={hotel.rooms} />
            <Field label="Мин. площадь" value={hotel.room_min} />
            <Field label="Типы номеров" value={hotel.room_types} />
            <Field label="Питание" value={hotel.meals} />
            <Field label="Пляж" value={hotel.beach} />
            <Field label="Бассейны" value={hotel.pools} />
            <Field label="Дети" value={hotel.kids} />
            <Field label="Спа" value={hotel.spa} />
            <Field label="Рестораны" value={hotel.restaurants} />
            <Field label="Депозит" value={hotel.deposit} />
            <Field label="Трансфер" value={hotel.transfer} />
            <Field label="Русскоговорящий персонал" value={hotel.russian_staff} />
          </div>

          {hotel.details.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              {hotel.details.map((d, i) => (
                <Field key={i} label={d.label} value={d.value} />
              ))}
            </div>
          )}

          {hotel.news && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/40">Новости и реновации</p>
              <p className="mt-1 text-sm text-foreground/80">{hotel.news}</p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {hotel.best_for && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700">Кому подойдёт</p>
                <p className="mt-1 text-sm text-green-900">{hotel.best_for}</p>
              </div>
            )}
            {hotel.not_for && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">Кому не подойдёт</p>
                <p className="mt-1 text-sm text-red-900">{hotel.not_for}</p>
              </div>
            )}
          </div>

          <OpenLeadFormButton
            className="mt-6 w-full rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue"
            comment={`Интересует отель: ${hotel.name} (${hotel.country}${hotel.region ? ", " + hotel.region : ""})`}
          >
            Оставить заявку на этот отель
          </OpenLeadFormButton>
        </div>
      </div>
    </div>
  );
}
