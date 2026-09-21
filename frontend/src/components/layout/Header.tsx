"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import ContactCtaButtons from "@/components/lead-form/ContactCtaButtons";
import Logo from "@/components/ui/Logo";

const NAV_LINKS = [
  { href: "/tours", label: "Туры" },
  { href: "/directions", label: "Направления" },
  { href: "/cruises", label: "Круизы" },
  { href: "/promotions", label: "Акции" },
  { href: "/blog", label: "Блог" },
  { href: "/about", label: "О нас" },
  { href: "/team", label: "Команда" },
  { href: "/certificates", label: "Сертификаты" },
  { href: "/contacts", label: "Контакты" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Logo />

        <nav className="hidden items-center gap-5 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-navy/80 transition-colors hover:text-navy"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <ContactCtaButtons variant="header" comment="Заявка из шапки сайта" className="hidden lg:flex" />

        <button
          type="button"
          className="text-navy lg:hidden"
          aria-label="Меню"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-black/5 bg-white px-4 pb-6 pt-2 lg:hidden">
          <nav className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="py-1 text-sm font-medium text-navy/80"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <ContactCtaButtons variant="panel" comment="Заявка из мобильной шапки сайта" className="mt-4" />
        </div>
      )}
    </header>
  );
}
