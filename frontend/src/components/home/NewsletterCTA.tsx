import { Gift, Heart, Luggage, Mail, Star } from "lucide-react";
import NewsletterForm from "./NewsletterForm";

const FEATURES = [
  {
    icon: Mail,
    title: "Полезные идеи и выгодные предложения",
    text: "Подпишитесь и получайте самое лучшее первым",
  },
  {
    icon: Heart,
    title: "Забота после поездки",
    text: "Спасибо за доверие! Поддержим, подскажем, поможем и в следующий раз",
  },
  {
    icon: Star,
    title: "Ваш отзыв важен",
    text: "Будем благодарны за отзыв — он помогает нам становиться лучше",
  },
  {
    icon: Luggage,
    title: "Планируйте следующую поездку",
    text: "Подготовим незабываемое путешествие с бонусами",
  },
];

export default function NewsletterCTA() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[2rem] bg-navy">
        <div className="grid grid-cols-1 gap-10 p-8 sm:p-12 lg:grid-cols-[280px_1fr] lg:gap-16">
          <div>
            <h2 className="text-2xl font-bold leading-snug text-white">
              Путешествия, к которым хочется возвращаться
            </h2>
            <div className="mt-6 flex items-center gap-2">
              <Gift size={18} className="text-gold" />
            </div>
            <p className="mb-4 mt-2 text-xs text-white/60">
              Получайте лучшие идеи для отдыха и эксклюзивные предложения
            </p>
            <NewsletterForm />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-gold">
                  <Icon size={17} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/50">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
