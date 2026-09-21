"use client";

import { ClipboardList, Mail, MessageCircle, Phone, Send } from "lucide-react";
import OpenLeadFormButton from "./OpenLeadFormButton";

const MAX_LINK = "https://max.ru/id583513901480_biz";
const TELEGRAM_LINK = "https://t.me/sletat_ru_pnz";
const WHATSAPP_LINK = "https://wa.me/79502302555?text=%D0%A5%D0%BE%D1%87%D1%83%20%D0%BF%D0%BE%D0%B4%D0%BE%D0%B1%D1%80%D0%B0%D1%82%D1%8C%20%D1%82%D1%83%D1%80";
const PHONE_LINK = "tel:+79502302555";
const EMAIL_LINK = "mailto:pnztour@mail.ru?subject=%D0%9F%D0%BE%D0%B4%D0%B1%D0%BE%D1%80%20%D1%82%D1%83%D1%80%D0%B0";

type Props = {
  variant?: "header" | "hero" | "panel";
  comment?: string;
  className?: string;
};

const baseButton = "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors";

export default function ContactCtaButtons({ variant = "hero", comment = "Заявка с сайта", className = "" }: Props) {
  if (variant === "header") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <a href={MAX_LINK} target="_blank" rel="noopener noreferrer" aria-label="Написать в MAX" title="MAX" className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-light text-navy transition hover:bg-blue-light/70">
          <MessageCircle size={17} />
        </a>
        <a href={TELEGRAM_LINK} target="_blank" rel="noopener noreferrer" aria-label="Написать в Telegram" title="Telegram" className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-light text-blue transition hover:bg-blue-light/70">
          <Send size={17} />
        </a>
        <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" aria-label="Написать в WhatsApp" title="WhatsApp" className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-700 transition hover:bg-green-100">
          <MessageCircle size={17} />
        </a>
        <a href={PHONE_LINK} aria-label="Позвонить" title="Позвонить" className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 text-navy transition hover:bg-gold/30">
          <Phone size={17} />
        </a>
        <a href={EMAIL_LINK} aria-label="Написать на email" title="Email" className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-light text-navy transition hover:bg-blue-light/70">
          <Mail size={17} />
        </a>
        <OpenLeadFormButton comment={comment} className="rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-navy-dark transition-colors hover:bg-gold-dark">
          Заявка
        </OpenLeadFormButton>
      </div>
    );
  }

  const compact = variant === "panel";

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <a href={MAX_LINK} target="_blank" rel="noopener noreferrer" className={`${baseButton} bg-navy px-4 py-3 text-white hover:bg-navy/90`}>
        <MessageCircle size={18} />
        MAX
      </a>
      <a href={TELEGRAM_LINK} target="_blank" rel="noopener noreferrer" className={`${baseButton} bg-blue px-4 py-3 text-white hover:bg-blue/90`}>
        <Send size={18} />
        Telegram
      </a>
      <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className={`${baseButton} bg-green-600 px-4 py-3 text-white hover:bg-green-700`}>
        <MessageCircle size={18} />
        WhatsApp
      </a>
      <a href={PHONE_LINK} className={`${baseButton} border border-navy/20 bg-white px-4 py-3 text-navy hover:bg-navy/5`}>
        <Phone size={18} />
        Позвонить
      </a>
      <a href={EMAIL_LINK} className={`${baseButton} border border-navy/20 bg-white px-4 py-3 text-navy hover:bg-navy/5`}>
        <Mail size={18} />
        Email
      </a>
      <OpenLeadFormButton comment={comment} className={`${baseButton} ${compact ? "bg-gold px-4 py-3" : "bg-gold px-5 py-3"} text-navy-dark hover:bg-gold-dark`}>
        <ClipboardList size={18} />
        Оставить заявку
      </OpenLeadFormButton>
    </div>
  );
}
