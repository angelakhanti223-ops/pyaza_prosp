import forecasts from "@/content/travelHoroscope2027.json";

export const ZODIAC_FORECASTS = forecasts;
export type ZodiacForecast = (typeof forecasts)[number];

/** Calendar intervals from the supplied editorial, not an astronomical ephemeris. */
export function zodiacForBirthDate(value: string, today = new Date()): ZodiacForecast | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > days[month - 1]) return null;
  const current = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  if (year * 10000 + month * 100 + day > current) return null;
  const date = month * 100 + day;
  return forecasts.find(sign => sign.start <= sign.end
    ? date >= sign.start && date <= sign.end
    : date >= sign.start || date <= sign.end) ?? null;
}

/** A lead contains the selection only; the birthday is never part of its payload. */
export function horoscopeLeadComment(sign: ZodiacForecast, route?: string): string {
  return `Звёздный маршрут 2027. Знак: ${sign.name}.${route ? ` Направление: ${route}.` : " Подобрать путешествие по прогнозу."}`;
}
