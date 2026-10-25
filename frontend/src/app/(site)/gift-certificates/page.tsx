import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gift, Globe2, Heart, MapPin, Phone, Sparkles } from "lucide-react";
import GiftCertificateForm from "@/components/gifts/GiftCertificateForm";

export const metadata: Metadata = {
  title: "Подарочный сертификат на путешествие — Слетать.ру, Пенза",
  description: "Подарите близким путешествие: подарочный сертификат на выбранную вами сумму. Оставьте заявку в Слетать.ру, ТЦ «Проспект», Пенза.",
  alternates: { canonical: "/gift-certificates" },
  openGraph: { title: "Не знаете, что подарить? Подарите весь мир", description: "Подарочный сертификат на путешествие от Слетать.ру в Пензе", images: [{ url: "/images/gift-certificate-coast.webp", width: 1536, height: 1024 }] },
};

const features = [
  { Icon: Globe2, title: "Мечта вместо вещи", text: "Море, новые города или круиз — начните с идеи путешествия." },
  { Icon: Gift, title: "Сумма на ваш выбор", text: "Вы определяете бюджет подарка, а мы помогаем с оформлением." },
  { Icon: Heart, title: "Личный знак внимания", text: "Для любимых, родителей, друзей и тех, кому хочется сказать спасибо." },
  { Icon: Sparkles, title: "Помощь с путешествием", text: "Получателю поможем подобрать поездку под его пожелания." },
];
const questions = [
  ["На какую сумму можно оформить сертификат?", "На выбранную вами сумму. Укажите её в заявке или обсудите с менеджером — поможем определиться с бюджетом подарка."],
  ["Нужно ли заранее выбирать тур и даты?", "При подаче заявки выбирать конкретную поездку не нужно. Расскажите об идее подарка, а условия использования и порядок выбора тура мы согласуем перед оформлением сертификата."],
  ["Как получить сертификат?", "Оставьте заявку, и мы обсудим оформление, удобный способ получения и оплату. Также можно обратиться в офис в ТЦ «Проспект» в Пензе."],
  ["Какой срок действия и можно ли доплатить за тур?", "Срок действия, порядок использования, доплаты и возврата менеджер разъяснит до оплаты. Все согласованные условия будут указаны в документах на сертификат."],
];

export default function GiftCertificatesPage() {
  return <>
    <section className="overflow-hidden bg-gradient-to-b from-blue-light to-white">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-7 sm:px-6 lg:px-8 lg:pb-24">
        <nav aria-label="Хлебные крошки" className="mb-9 flex flex-wrap gap-2 text-xs text-navy/55"><Link href="/" className="hover:text-blue">Главная</Link><span>/</span><span>Подарочные сертификаты</span></nav>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-white/70 px-4 py-2 text-xs font-semibold text-navy"><Gift size={15} className="text-gold-dark"/>Подарочный сертификат на путешествие</span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.12] tracking-tight text-navy sm:text-5xl xl:text-6xl">Не знаете,<br/>что подарить?<br/><span className="text-blue">Подарите весь мир.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-foreground/70 sm:text-lg">Есть подарки, которые остаются на полке. А есть те, которые становятся тёплым морем, любимым городом и воспоминаниями на двоих.</p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-foreground/70">Подарочный сертификат от «Слетать.ру» — первый шаг к путешествию, которое выберет ваш близкий.</p>
            <a href="#application" className="mt-8 inline-flex items-center gap-3 rounded-full bg-navy px-7 py-4 text-sm font-semibold text-white transition hover:bg-blue">Подарить путешествие <ArrowRight size={18}/></a>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-navy/60"><span>На выбранную вами сумму</span><span className="h-1 w-1 rounded-full bg-gold"/><span>С заботой о получателе</span></div>
          </div>
          <div className="relative pb-7">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-2xl shadow-navy/10 sm:aspect-[6/5]"><Image src="/images/gift-certificate-coast.webp" alt="Подарочный сертификат с синей лентой на солнечной террасе у моря" fill priority unoptimized sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover"/></div>
            <div className="absolute bottom-0 left-4 right-4 flex items-center gap-4 rounded-2xl border border-navy/5 bg-white p-5 shadow-xl shadow-navy/10 sm:left-8 sm:right-8"><span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-cream text-gold-dark"><Gift size={25}/></span><div><p className="text-sm font-bold text-navy">Путешествия, которые остаются с вами</p><p className="mt-1 text-xs leading-relaxed text-foreground/55">Для важного повода. И просто потому, что любите.</p></div></div>
            <p className="mt-9 text-center text-[11px] text-foreground/45">Иллюстрация. Оформление сертификата согласуем при заказе.</p>
          </div>
        </div>
      </div>
    </section>
    <section aria-label="О подарке" className="border-y border-navy/5 bg-white"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">{features.map(({Icon,title,text}) => <div key={title}><Icon size={26} strokeWidth={1.5} className="mb-4 text-gold-dark"/><h2 className="font-semibold text-navy">{title}</h2><p className="mt-2 text-sm leading-relaxed text-foreground/60">{text}</p></div>)}</div></section>
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"><div className="mb-10 max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.16em] text-blue">Три простых шага</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">От вашей идеи — к красивому подарку</h2></div><div className="grid gap-8 md:grid-cols-3">{[
      ["01", "Оставьте заявку", "Укажите контакты, желаемую сумму и важную дату, если уже её знаете."],
      ["02", "Обсудим детали", "Согласуем условия использования, оформление, получение и оплату сертификата."],
      ["03", "Подарите предвкушение", "Вручите сертификат, а с выбором путешествия получателю поможем мы."],
    ].map(([n,title,text]) => <div key={n} className="border-t border-navy/15 pt-6"><span className="text-3xl font-light text-gold-dark">{n}</span><h3 className="mt-4 text-lg font-semibold text-navy">{title}</h3><p className="mt-2 text-sm leading-relaxed text-foreground/65">{text}</p></div>)}</div></section>
    <section className="bg-blue-light/70"><div className="mx-auto grid max-w-7xl items-start gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[.85fr_1.15fr] lg:gap-20 lg:px-8 lg:py-20"><div className="lg:sticky lg:top-28"><p className="text-xs font-semibold uppercase tracking-[.16em] text-blue">Начнём с вашего пожелания</p><h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-navy sm:text-4xl">Подарите не просто поездку.<br/><span className="text-blue">Подарите «я давно об этом мечтал».</span></h2><p className="mt-6 text-base leading-relaxed text-foreground/65">Расскажите, для кого готовите сюрприз. Поможем превратить вашу идею в подарок и заранее объясним все условия.</p><div className="mt-8 space-y-5 border-t border-navy/10 pt-7"><p className="flex items-start gap-3 text-sm leading-relaxed text-navy/75"><MapPin size={19} className="mt-0.5 shrink-0 text-gold-dark"/>Пенза, пр-т Строителей, 49А<br/>ТЦ «Проспект», 1 этаж</p><a href="tel:+79502302555" className="flex items-center gap-3 text-sm font-semibold text-navy"><Phone size={18} className="text-gold-dark"/>+7 (950) 230-25-55</a><p className="text-xs text-foreground/55">Ежедневно с 9:00 до 21:00 • московское время</p></div></div><GiftCertificateForm/></div></section>
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20"><h2 className="mb-8 text-3xl font-bold text-navy">Важное о сертификате</h2><div className="divide-y divide-navy/10">{questions.map(([q,a]) => <details key={q} className="group py-5"><summary className="cursor-pointer text-base font-semibold text-navy">{q}</summary><p className="mt-4 text-sm leading-relaxed text-foreground/65">{a}</p></details>)}</div><p className="mt-6 text-xs leading-relaxed text-foreground/50">Страница содержит предложение оставить заявку. Конкретные условия сертификата согласуются перед оплатой.</p></section>
  </>;
}
