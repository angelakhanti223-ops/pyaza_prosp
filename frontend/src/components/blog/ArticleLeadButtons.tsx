"use client";

import ContactCtaButtons from "@/components/lead-form/ContactCtaButtons";

type Props = {
  title?: string;
  text?: string;
  compact?: boolean;
  comment?: string;
};

export default function ArticleLeadButtons({
  title = "Подобрать тур под ваш отпуск",
  text = "Напишите, когда хотите поехать, на сколько ночей, сколько человек едет и какой бюджет комфортен. Мы сравним направления, отели и перелёты и предложим подходящие варианты.",
  compact = false,
  comment = "Заявка из статьи блога",
}: Props) {
  return (
    <section className={`rounded-3xl border border-blue-light bg-blue-light/45 ${compact ? "mt-8 p-5" : "mt-10 p-5 sm:p-7"}`}>
      <div className="grid gap-5 sm:grid-cols-[1.1fr_1.2fr] sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue">Заявка на подбор</p>
          <h2 className="mt-2 text-xl font-bold text-navy sm:text-2xl">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-foreground/70">{text}</p>
        </div>

        <ContactCtaButtons variant="panel" comment={comment} />
      </div>
    </section>
  );
}
