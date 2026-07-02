import { CreditCard, MessageCircle, ShieldCheck, FileEdit } from "lucide-react";

const STEPS = [
  {
    icon: FileEdit,
    title: "Оставьте заявку",
    text: "Заполните форму или свяжитесь с нами удобным для вас способом",
  },
  {
    icon: MessageCircle,
    title: "Обсудим варианты",
    text: "Подберём лучшие туры под ваш бюджет и пожелания",
  },
  {
    icon: ShieldCheck,
    title: "Подтверждаем и бронируем",
    text: "Зафиксируем цену и забронируем тур на ваши даты",
  },
  {
    icon: CreditCard,
    title: "Оплачиваете и готовитесь",
    text: "Удобная оплата, все документы и советы — в одном месте",
  },
];

export default function BookingSteps() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h2 className="text-center text-2xl font-bold text-navy sm:text-3xl">
        Как забронировать путешествие
      </h2>

      <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <div key={title} className="relative text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-gold/40 text-gold">
              <Icon size={24} />
            </div>
            <p className="mt-3 text-xs font-semibold text-gold">{i + 1}</p>
            <p className="mt-1 text-sm font-semibold text-navy">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-foreground/60">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
