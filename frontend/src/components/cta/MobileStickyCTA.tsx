"use client";

import { Mail, MessageCircle, Phone } from "lucide-react";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";

const MAX_LINK = "https://max.ru/id583513901480_biz";
const WHATSAPP_LINK = "https://wa.me/79502302555?text=%D0%A5%D0%BE%D1%87%D1%83%20%D0%BF%D0%BE%D0%B4%D0%BE%D0%B1%D1%80%D0%B0%D1%82%D1%8C%20%D1%82%D1%83%D1%80";
const PHONE_LINK = "tel:+79502302555";
const EMAIL_LINK = "mailto:pnztour@mail.ru?subject=%D0%9F%D0%BE%D0%B4%D0%B1%D0%BE%D1%80%20%D1%82%D1%83%D1%80%D0%B0";

const smallButton = "inline-flex items-center justify-center gap-1 rounded-full px-2 py-2 text-[11px] font-semibold";

export default function MobileStickyCTA() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white/95 px-3 py-2 shadow-2xl backdrop-blur sm:hidden">
      <div className="mx-auto flex max-w-md flex-col gap-2 pr-16">
        <div className="grid grid-cols-4 gap-1.5">
          <a href={MAX_LINK} target="_blank" rel="noopener noreferrer" className={`${smallButton} bg-navy text-white`}>
            <MessageCircle size={14} />
            MAX
          </a>
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className={`${smallButton} bg-green-600 text-white`}>
            <MessageCircle size={14} />
            WA
          </a>
          <a href={PHONE_LINK} className={`${smallButton} bg-gold/25 text-navy`}>
            <Phone size={14} />
            Звонок
          </a>
          <a href={EMAIL_LINK} className={`${smallButton} bg-blue-light text-navy`}>
            <Mail size={14} />
            Email
          </a>
        </div>
        <OpenLeadFormButton
          comment="Заявка из мобильной липкой кнопки"
          className="inline-flex w-full items-center justify-center rounded-full bg-gold px-3 py-2.5 text-xs font-semibold text-navy-dark"
        >
          Подобрать тур
        </OpenLeadFormButton>
      </div>
    </div>
  );
}
