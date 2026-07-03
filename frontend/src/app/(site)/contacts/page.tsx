import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import PageHero from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Контакты — Слетать.ру",
  description: "Контакты сети туристических агентств Слетать.ру: адрес офиса в Пензе, телефоны, режим работы.",
};

const OFFICE_MAP_SRC =
  "https://www.google.com/maps?q=%D0%9F%D0%B5%D0%BD%D0%B7%D0%B0,%20%D0%9F%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%20%D0%A1%D1%82%D1%80%D0%BE%D0%B8%D1%82%D0%B5%D0%BB%D0%B5%D0%B9%2049%D0%90&output=embed";

export default function ContactsPage() {
  return (
    <div>
      <PageHero
        title="Контакты"
        text="Всегда на связи — звоните, пишите или приходите в офис в Пензе."
      />
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-3">
            <MapPin size={20} className="mt-0.5 shrink-0 text-gold" />
            <div>
              <p className="text-sm font-semibold text-navy">Адрес офиса</p>
              <p className="mt-1 text-sm text-foreground/60">
                г. Пенза, Пр-т Строителей, 49А, ТЦ «Проспект»
              </p>
              <p className="mt-1 text-xs text-foreground/40">Ежедневно с 9:00 до 21:00</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone size={20} className="mt-0.5 shrink-0 text-gold" />
            <div>
              <p className="text-sm font-semibold text-navy">Телефоны</p>
              <a href="tel:+79502302555" className="mt-1 block text-sm text-foreground/60 hover:text-blue">
                8-950-230-25-55
              </a>
              <a href="tel:+79991104188" className="mt-0.5 block text-sm text-foreground/60 hover:text-blue">
                8-999-110-41-88
              </a>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail size={20} className="mt-0.5 shrink-0 text-gold" />
            <div>
              <p className="text-sm font-semibold text-navy">Мессенджеры</p>
              <a
                href="https://t.me/sletat_ru_pnz"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-sm text-foreground/60 hover:text-blue"
              >
                Telegram: @sletat_ru_pnz
              </a>
              <a
                href="https://vk.com/sletat_ru_pnz"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 block text-sm text-foreground/60 hover:text-blue"
              >
                ВКонтакте: @sletat_ru_pnz
              </a>
            </div>
          </div>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl lg:aspect-auto">
          <iframe
            src={OFFICE_MAP_SRC}
            title="Карта проезда до офиса Слетать.ру"
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  );
}
