"use client";

import { ClipboardList, MessageCircle, Send } from "lucide-react";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";

const MAX_LINK = "https://max.ru/id583513901480_biz";
const TELEGRAM_LINK = "https://t.me/sletat_ru_pnz";

type Props = {
  title?: string;
  text?: string;
  compact?: boolean;
};

export default function ArticleLeadButtons({
  title = "Подобрать тур под ваш отпуск",
  text = "Напишите, когда хотите поехать, на сколько ночей, сколько человек едет и какой бюджет комфортен. Мы сравним направления, отели и перелёты и предложим подходящие варианты.",
  compact = false,
}: Props) {
  return (
    <section className={`rounded-3xl border border-blue-light bg-blue-light/45 ${compact ? "mt-8 p-5" : "mt-10 p-5 sm:p-7"}`}>
      <div className="grid gap-5 sm:grid-cols-[1.2fr_1fr] sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue">Заявка на подбор</p>
          <h2 className="mt-2 text-xl font-bold text-navy sm:text-2xl">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-foreground/70">{text}</p>
        </div>

        <div className="grid gap-2">
          <a
            href={MAX_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-navy/90"
          >
            <MessageCircle size={18} />
            Написать в MAX
          </a>
          <a
            href={TELEGRAM_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-blue px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue/90"
          >
            <Send size={18} />
            Написать в Telegram
          </a>
          <OpenLeadFormButton
            comment="Заявка из статьи: Где отдохнуть в октябре"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-blue bg-white px-5 py-3 text-sm font-semibold text-blue shadow-sm transition hover:bg-blue-light"
          >
            <ClipboardList size={18} />
            Оставить заявку на сайте
          </OpenLeadFormButton>
        </div>
      </div>
    </section>
  );
}
