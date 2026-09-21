"use client";

import { MessageCircle } from "lucide-react";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";

const WHATSAPP_LINK = "https://wa.me/79502302555?text=%D0%A5%D0%BE%D1%87%D1%83%20%D0%BF%D0%BE%D0%B4%D0%BE%D0%B1%D1%80%D0%B0%D1%82%D1%8C%20%D1%82%D1%83%D1%80";

export default function MobileStickyCTA() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white/95 px-3 py-3 shadow-2xl backdrop-blur sm:hidden">
      <div className="mx-auto flex max-w-sm gap-2 pr-16">
        <a
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-green-600 px-3 py-3 text-xs font-semibold text-white"
        >
          <MessageCircle size={16} />
          WhatsApp
        </a>
        <OpenLeadFormButton
          comment="Заявка из мобильной липкой кнопки"
          className="inline-flex flex-1 items-center justify-center rounded-full bg-gold px-3 py-3 text-xs font-semibold text-navy-dark"
        >
          Подобрать тур
        </OpenLeadFormButton>
      </div>
    </div>
  );
}
