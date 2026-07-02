import { Globe, Headset, MapPin, ShieldCheck } from "lucide-react";

const ITEMS = [
  {
    icon: Globe,
    title: "Онлайн по всей России",
    text: "Быстро, удобно, без очередей",
  },
  {
    icon: ShieldCheck,
    title: "Прозрачные условия",
    text: "Без скрытых платежей и навязанных услуг",
  },
  {
    icon: Headset,
    title: "Поддержка 24/7",
    text: "До, во время и после поездки",
  },
  {
    icon: MapPin,
    title: "Офис в Пензе",
    text: "Всегда рады видеть вас в нашем офисе",
  },
];

export default function Advantages() {
  return (
    <section className="border-y border-black/5 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        {ITEMS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-light text-blue">
              <Icon size={22} />
            </span>
            <div>
              <p className="text-sm font-semibold text-navy">{title}</p>
              <p className="mt-0.5 text-xs text-foreground/60">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
