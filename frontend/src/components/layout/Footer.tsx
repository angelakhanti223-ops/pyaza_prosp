import Link from "next/link";
import { MapPin, Phone, Send } from "lucide-react";
import Logo from "@/components/ui/Logo";

export default function Footer() {
  return (
    <footer className="bg-navy-dark text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo variant="dark" />
            <p className="mt-4 text-sm text-white/60">
              Путешествуйте с теми, кто заботится о вас
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-white/90">Адрес офиса</h4>
            <p className="flex items-start gap-2 text-sm text-white/60">
              <MapPin size={16} className="mt-0.5 shrink-0 text-gold" />
              г. Пенза, Пр-т Строителей, 49А,
              <br />
              ТЦ «Проспект»
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-white/90">Телефоны</h4>
            <div className="flex flex-col gap-1.5 text-sm text-white/60">
              <a href="tel:+78002502555" className="flex items-center gap-2 hover:text-white">
                <Phone size={16} className="text-gold" />
                8-800-250-25-55
              </a>
              <a href="tel:+79991104188" className="flex items-center gap-2 hover:text-white">
                <Phone size={16} className="text-gold" />
                8-999-110-41-88
              </a>
              <p className="mt-1 text-xs text-white/40">Ежедневно с 9:00 до 21:00</p>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-white/90">
              Мы в соцсетях и мессенджерах
            </h4>
            <div className="flex flex-col gap-1.5 text-sm text-white/60">
              <a
                href="https://vk.com/sletat_ru_pnz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-white"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">
                  VK
                </span>
                ВКонтакте
              </a>
              <a
                href="https://t.me/sletat_ru_pnz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-white"
              >
                <Send size={16} className="text-gold" />
                Telegram
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© Слетать.ру, г. Пенза. Все права защищены.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-white/70">
              Политика конфиденциальности
            </Link>
            <Link href="/terms" className="hover:text-white/70">
              Пользовательское соглашение
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
