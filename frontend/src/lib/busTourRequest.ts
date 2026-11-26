import tours from "../../public/bus-assets/winter-2026-2027/tours.json";

/** Resolve an ID against the same catalogue that the public cards display. */
export function busTourRequestComment(id: string | string[] | undefined): string | undefined {
  if (typeof id !== "string" || !/^[1-9]\d{0,2}$/.test(id)) return undefined;
  const tour = tours.find((item) => item.id === Number(id));
  if (!tour) return undefined;
  return [
    `Интересует автобусный тур: «${tour.title}».`,
    `Даты выезда: ${tour.date} (зима 2026–2027).`,
    `Маршрут: ${tour.route}.`,
    `Стоимость: от ${new Intl.NumberFormat("ru-RU").format(tour.price)} ₽ за человека.`,
  ].join("\n");
}
