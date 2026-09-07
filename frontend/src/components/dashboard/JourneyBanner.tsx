import Image from "next/image";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

// Декоративная шапка дашборда — маршрут с целями (Египет/Париж/Мальдивы) нарисован
// прямо на картинке вместе с суммами, поэтому это статичная иллюстрация, а не живые
// данные: числа на ней не связаны с реальными MonthlyPlan.target_commission ниже.
export default function JourneyBanner({ children }: Props) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-b-[28px] border border-blue/10 bg-gradient-to-b from-sky-100 via-sky-50 to-white pb-8 pt-6 shadow-[0_12px_40px_rgba(27,78,126,0.10)]">
      <div className="pointer-events-none absolute left-[7%] bottom-8 h-11 w-40 rounded-full bg-white/60" />
      <div className="pointer-events-none absolute right-[4%] bottom-12 h-11 w-40 rounded-full bg-white/45" />

      <div className="relative z-10 px-4 sm:px-6">{children}</div>

      <div className="relative z-0 mt-4 overflow-x-auto px-4 sm:px-6">
        <div className="relative mx-auto h-28 min-w-[640px] max-w-4xl sm:h-32">
          <Image
            src="/dashboard/journey-strip.webp"
            alt="Маршрут к цели: 60 000 ₽ — Египет, 100 000 ₽ — Париж, 150 000 ₽ — Мальдивы"
            fill
            className="object-contain [mask-image:linear-gradient(90deg,transparent,black_4%,black_96%,transparent)]"
            sizes="(max-width: 768px) 640px, 900px"
          />
        </div>
      </div>
    </div>
  );
}
