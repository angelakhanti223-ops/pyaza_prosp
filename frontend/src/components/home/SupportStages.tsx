import { Bell, Calendar, FileText, Heart, Plane } from "lucide-react";

const STAGES = [
  {
    icon: Calendar,
    title: "До поездки",
    text: "Советуем, помогаем с выбором, отвечаем на ваши вопросы",
  },
  {
    icon: FileText,
    title: "Документы и визы",
    text: "Подскажем, какие документы нужны, поможем с оформлением",
  },
  {
    icon: Bell,
    title: "Напоминания перед вылетом",
    text: "Отправим все важные детали и напомним о главном",
  },
  {
    icon: Plane,
    title: "На связи в поездке",
    text: "Поддержка 24/7, решаем любые вопросы оперативно",
  },
  {
    icon: Heart,
    title: "После поездки",
    text: "Интересуемся впечатлениями и остаёмся на связи",
  },
];

export default function SupportStages() {
  return (
    <section className="bg-blue-light">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold text-navy sm:text-3xl">
          Мы рядом на каждом этапе путешествия
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {STAGES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-blue shadow-sm">
                <Icon size={22} />
              </div>
              <p className="mt-3 text-sm font-semibold text-navy">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/60">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
