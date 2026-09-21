import { Mail, MessageCircle, Phone, Send, Sparkles } from "lucide-react";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";

const MAX_LINK = "https://max.ru/id583513901480_biz";
const TELEGRAM_LINK = "https://t.me/sletat_ru_pnz";
const WHATSAPP_LINK = "https://wa.me/79502302555?text=%D0%A5%D0%BE%D1%87%D1%83%20%D0%BF%D0%BE%D0%B4%D0%BE%D0%B1%D1%80%D0%B0%D1%82%D1%8C%20%D1%82%D1%83%D1%80";
const PHONE_LINK = "tel:+79502302555";
const EMAIL_LINK = "mailto:pnztour@mail.ru?subject=%D0%9F%D0%BE%D0%B4%D0%B1%D0%BE%D1%80%20%D1%82%D1%83%D1%80%D0%B0";

type Props = {
  eyebrow?: string;
  title: string;
  text: string;
  primaryLabel?: string;
  comment?: string;
  className?: string;
  compact?: boolean;
};

const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20";

export default function SiteCtaBlock({
  eyebrow = "Бесплатная консультация",
  title,
  text,
  primaryLabel = "Получить подборку",
  comment = "Заявка из CTA-блока сайта",
  className = "",
  compact = false,
}: Props) {
  return (
    <div className={`rounded-3xl bg-navy p-6 text-white shadow-xl sm:p-8 ${className}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold">
            <Sparkles size={14} />
            {eyebrow}
          </p>
          <h2 className={`${compact ? "mt-3 text-xl" : "mt-4 text-2xl"} font-bold leading-tight sm:text-3xl`}>
            {title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/75 sm:text-base">{text}</p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-[430px] lg:justify-end">
          <OpenLeadFormButton
            comment={comment}
            className="inline-flex items-center justify-center rounded-full bg-gold px-5 py-3 text-sm font-semibold text-navy-dark transition-colors hover:bg-gold-dark"
          >
            {primaryLabel}
          </OpenLeadFormButton>
          <a href={MAX_LINK} target="_blank" rel="noopener noreferrer" className={`${secondaryButton} bg-white/20`}>
            <MessageCircle size={17} />
            MAX
          </a>
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
            <MessageCircle size={17} />
            WhatsApp
          </a>
          <a href={TELEGRAM_LINK} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
            <Send size={17} />
            Telegram
          </a>
          <a href={PHONE_LINK} className={secondaryButton}>
            <Phone size={17} />
            Звонок
          </a>
          <a href={EMAIL_LINK} className={secondaryButton}>
            <Mail size={17} />
            Email
          </a>
        </div>
      </div>
    </div>
  );
}
