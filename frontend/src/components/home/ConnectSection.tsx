import Image from "next/image";
import { Send } from "lucide-react";
import ReviewsCarousel from "./ReviewsCarousel";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";

const OFFICE_MAP_SRC =
  "https://www.google.com/maps?q=%D0%9F%D0%B5%D0%BD%D0%B7%D0%B0,%20%D0%9F%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%20%D0%A1%D1%82%D1%80%D0%BE%D0%B8%D1%82%D0%B5%D0%BB%D0%B5%D0%B9%2049%D0%90&output=embed";

export default function ConnectSection() {
  return (
    <section className="bg-blue-light/50 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold text-navy sm:text-3xl">Мы всегда на связи</h2>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl ring-2 ring-gold/30">
            <ReviewsCarousel />
          </div>

          <div className="flex flex-col rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-navy">Мы на связи</p>
            <div className="mt-4 flex flex-col gap-3 text-xs">
              <a
                href="https://t.me/sletat_ru_pnz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-foreground/70 hover:text-blue"
              >
                <Send size={16} className="text-blue" />
                <span>
                  Telegram
                  <br />
                  <span className="text-foreground/50">@sletat_ru_pnz</span>
                </span>
              </a>
              <a
                href="https://vk.com/sletat_ru_pnz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-foreground/70 hover:text-blue"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-blue text-[9px] font-bold text-white">
                  VK
                </span>
                <span>
                  ВКонтакте
                  <br />
                  <span className="text-foreground/50">@sletat_ru_pnz</span>
                </span>
              </a>
            </div>
            <OpenLeadFormButton className="mt-auto pt-4 text-xs font-semibold text-blue underline underline-offset-2 text-left">
              Написать нам
            </OpenLeadFormButton>
          </div>

          <div className="flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
            <div className="relative aspect-[16/10]">
              <Image
                src="https://picsum.photos/seed/sletat-office/400/260"
                alt="Наш офис в Пензе"
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col p-5">
              <p className="text-sm font-semibold text-navy">Наш офис в Пензе</p>
              <p className="mt-1 text-xs text-foreground/60">
                г. Пенза, Пр-т Строителей, 49А, ТЦ «Проспект»
              </p>
              <a
                href="/contacts"
                className="mt-auto pt-4 text-xs font-semibold text-blue underline underline-offset-2"
              >
                Приходите в гости
              </a>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
            <div className="relative aspect-[16/10]">
              <iframe
                src={OFFICE_MAP_SRC}
                title="Карта проезда до офиса Слетать.ру"
                className="absolute inset-0 h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className="flex flex-1 flex-col p-5">
              <p className="text-sm font-semibold text-navy">Как нас найти</p>
              <p className="mt-1 text-xs text-foreground/60">
                г. Пенза, Пр-т Строителей, 49А, ТЦ «Проспект»
              </p>
              <a
                href="https://www.google.com/maps?q=Пенза,+Проспект+Строителей+49А"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto pt-4 text-xs font-semibold text-blue underline underline-offset-2"
              >
                Показать на карте
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
