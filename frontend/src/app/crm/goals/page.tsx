"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Megaphone,
  MonitorCog,
  QrCode,
  Sparkles,
  Trophy,
} from "lucide-react";
import { fetchManagementDashboard, type ManagementDashboardData } from "@/lib/managementDashboardApi";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value || 0) + " ₽";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value || 0);
}

function percent(value: number, target: number): number {
  if (!target) return 0;
  return Math.round((value / target) * 100);
}

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

function ProgressBar({ value, tone = "blue" }: { value: number; tone?: "blue" | "gold" | "green" | "red" | "navy" }) {
  const fillClass =
    tone === "gold" ? "bg-gold" : tone === "green" ? "bg-emerald-500" : tone === "red" ? "bg-red-500" : tone === "navy" ? "bg-navy" : "bg-blue";
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-light">
      <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${clamp(value)}%` }} />
    </div>
  );
}

function KpiCard({
  title,
  actual,
  target,
  subtitle,
  formatter = formatNumber,
  tone = "blue",
}: {
  title: string;
  actual: number;
  target: number;
  subtitle: string;
  formatter?: (value: number) => string;
  tone?: "blue" | "gold" | "green" | "red" | "navy";
}) {
  const progress = percent(actual, target);
  return (
    <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">{title}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold text-navy">{formatter(actual)}</p>
          <p className="mt-1 text-xs text-foreground/45">цель: {formatter(target)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${progress >= 100 ? "bg-emerald-50 text-emerald-700" : "bg-blue-light text-navy"}`}>
          {progress}%
        </span>
      </div>
      <ProgressBar value={progress} tone={progress >= 100 ? "green" : tone} />
      <p className="mt-3 min-h-9 text-xs leading-5 text-foreground/55">{subtitle}</p>
    </div>
  );
}

function GoalCard({
  icon,
  title,
  target,
  fact,
  note,
  tone = "blue",
}: {
  icon: ReactNode;
  title: string;
  target: string;
  fact?: string;
  note: string;
  tone?: "blue" | "gold" | "green" | "red" | "navy";
}) {
  const toneClass = tone === "gold" ? "text-gold" : tone === "green" ? "text-emerald-600" : tone === "red" ? "text-red-600" : tone === "navy" ? "text-navy" : "text-blue";
  return (
    <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`rounded-2xl bg-blue-light/55 p-2.5 ${toneClass}`}>{icon}</div>
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug text-navy">{title}</h3>
          <p className="mt-2 text-sm font-semibold text-foreground/80">{target}</p>
          {fact && <p className="mt-1 text-xs text-foreground/45">{fact}</p>}
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-foreground/55">{note}</p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-black/5 bg-white/70 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-bold text-navy">{title}</h2>
        {subtitle && <p className="mt-1 text-sm leading-6 text-foreground/50">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

type ScheduleItem = {
  day: number;
  weekday: string;
  manager: "Елена" | "Катя";
  marker?: "elena-fixed" | "katya-request" | "elena-request";
};

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const OCTOBER_SCHEDULE_WEEKS: (ScheduleItem | null)[][] = [
  [
    null,
    null,
    null,
    { day: 1, weekday: "чт", manager: "Елена", marker: "elena-fixed" },
    { day: 2, weekday: "пт", manager: "Елена", marker: "elena-fixed" },
    { day: 3, weekday: "сб", manager: "Елена", marker: "elena-fixed" },
    { day: 4, weekday: "вс", manager: "Катя" },
  ],
  [
    { day: 5, weekday: "пн", manager: "Елена", marker: "katya-request" },
    { day: 6, weekday: "вт", manager: "Катя" },
    { day: 7, weekday: "ср", manager: "Елена", marker: "katya-request" },
    { day: 8, weekday: "чт", manager: "Катя" },
    { day: 9, weekday: "пт", manager: "Катя" },
    { day: 10, weekday: "сб", manager: "Катя" },
    { day: 11, weekday: "вс", manager: "Елена" },
  ],
  [
    { day: 12, weekday: "пн", manager: "Катя", marker: "elena-request" },
    { day: 13, weekday: "вт", manager: "Елена" },
    { day: 14, weekday: "ср", manager: "Елена" },
    { day: 15, weekday: "чт", manager: "Катя", marker: "elena-request" },
    { day: 16, weekday: "пт", manager: "Катя" },
    { day: 17, weekday: "сб", manager: "Елена" },
    { day: 18, weekday: "вс", manager: "Елена", marker: "katya-request" },
  ],
  [
    { day: 19, weekday: "пн", manager: "Катя", marker: "elena-request" },
    { day: 20, weekday: "вт", manager: "Елена" },
    { day: 21, weekday: "ср", manager: "Елена" },
    { day: 22, weekday: "чт", manager: "Катя" },
    { day: 23, weekday: "пт", manager: "Катя" },
    { day: 24, weekday: "сб", manager: "Елена" },
    { day: 25, weekday: "вс", manager: "Елена", marker: "katya-request" },
  ],
  [
    { day: 26, weekday: "пн", manager: "Катя" },
    { day: 27, weekday: "вт", manager: "Катя" },
    { day: 28, weekday: "ср", manager: "Елена" },
    { day: 29, weekday: "чт", manager: "Елена" },
    { day: 30, weekday: "пт", manager: "Катя" },
    { day: 31, weekday: "сб", manager: "Катя" },
    null,
  ],
];

const SCHEDULE_SUMMARY = [
  { title: "Елена", value: "16 смен", note: "работает 1–3 октября и закрывает дни, которые нужны Кате" },
  { title: "Катя", value: "15 смен", note: "закрывает 12, 15 и 19 октября" },
  { title: "Баланс", value: "16 / 15", note: "максимальный непрерывный блок — 3 смены подряд" },
];

function markerLabel(marker?: ScheduleItem["marker"]) {
  if (marker === "elena-fixed") return "фикс.";
  if (marker === "katya-request") return "день Кати";
  if (marker === "elena-request") return "день Елены";
  return "";
}

function ScheduleCell({ item }: { item: ScheduleItem | null }) {
  if (!item) return <div className="min-h-[82px] rounded-2xl border border-dashed border-black/5 bg-white/35" />;

  const isElena = item.manager === "Елена";
  return (
    <div className={`min-h-[82px] rounded-2xl border p-3 ${isElena ? "border-blue/20 bg-blue-light/45" : "border-gold/30 bg-gold/10"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold text-navy">{item.day}</p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-foreground/40">{item.weekday}</p>
        </div>
        {item.marker && (
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-foreground/55">
            {markerLabel(item.marker)}
          </span>
        )}
      </div>
      <p className={`mt-3 text-sm font-semibold ${isElena ? "text-blue" : "text-amber-700"}`}>{item.manager}</p>
    </div>
  );
}

const SOCIAL_GOALS = [
  {
    title: "Instagram",
    target: "с 0 до 150 подписчиков",
    fact: "ежедневные публикации по контент-плану",
    note: "Вести аккаунт ежедневно: сторис, посты/рилс, экспертность, офис, подборки, отзывы и сопровождение туристов.",
  },
  {
    title: "Threads / Тредс",
    target: "с 0 до 150 подписчиков",
    fact: "ежедневные публикации по контент-плану",
    note: "Дублировать и адаптировать короткий экспертный контент: заметки турагента, советы, направления, частые вопросы.",
  },
  {
    title: "Горящие туры",
    target: "с 36 до 100 подписчиков",
    fact: "подписывать всех, кто обратился в мессенджере или Telegram",
    note: "Главная механика роста — перевод каждого входящего обращения в подписку на канал с горящими турами.",
  },
];

const DEVELOPMENT_GOALS = [
  {
    title: "Сертификаты команды",
    target: "+2 сертификата Елене и +2 сертификата Екатерине",
    note: "Курсы Pasco или другой профильный источник. После получения — добавить сертификаты на сайт.",
    icon: <Trophy size={18} />,
  },
  {
    title: "Екатерина — Египет",
    target: "изучить направление и пройти тестирование",
    note: "Создать раздел Египта в базе знаний CRM: курорты, отели, кому предлагать, пляжи, питание, минусы, тест для закрепления.",
    icon: <BookOpenCheck size={18} />,
  },
  {
    title: "Мероприятия",
    target: "2 события за октябрь",
    note: "Онлайн бизнес-завтрак от IT + выездное мероприятие в кафе. По каждому — пост и фотофиксация.",
    icon: <CalendarDays size={18} />,
  },
];

const PRODUCT_GOALS = [
  {
    title: "Переделать сайт с Plykins на Emotions",
    target: "обновить визуал, стиль и позиционирование",
    note: "Перевести сайт в более эмоциональную и презентабельную упаковку бренда турагентства.",
    icon: <MonitorCog size={18} />,
  },
  {
    title: "Страница про горнолыжку",
    target: "отдельная страница + QR",
    note: "Сценарий: какой горнолыжный курорт подойдёт туристу. Использовать для витрины и консультаций.",
    icon: <QrCode size={18} />,
  },
  {
    title: "Витрины офиса",
    target: "6 листов с QR",
    note: "Переделать витрины: QR на статьи сайта, калькуляторы и подборочные страницы. Каждый лист должен вести к понятному сценарию.",
    icon: <Sparkles size={18} />,
  },
];

export default function OfficeGoalsPage() {
  const [data, setData] = useState<ManagementDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchManagementDashboard("current_month")
      .then((result) => {
        if (active) setData(result);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const actuals = useMemo(() => {
    const leads = data?.daily_rows.reduce((sum, row) => sum + row.leads, 0) ?? 0;
    const deals = data?.money.deals_count ?? 0;
    const conversion = leads ? Math.round((deals / leads) * 100) : 0;
    return {
      leads,
      deals,
      conversion,
      dealAmount: data?.money.deal_amount_total ?? 0,
      commission: data?.money.commission_total ?? 0,
    };
  }, [data]);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[32px] border border-black/5 bg-gradient-to-br from-navy via-blue to-gold/80 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">Офис · октябрь</p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Цели офиса на октябрь</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/80">
              Зафиксированы цели по продажам, лидам, рекламе, соцсетям, команде, сайту, витринам, мероприятиям и графику смен. Финансовые показатели и лиды подтягиваются из управленческого дашборда текущего месяца.
            </p>
          </div>
          <Link
            href="/crm/management-dashboard"
            className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
          >
            Управленческий дашборд <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-black/5 bg-white p-5 text-sm text-foreground/50">Загружаем факт по текущему месяцу…</div>
      ) : (
        <Section title="Главные KPI месяца" subtitle="Цели заданы на октябрь. Пока месяц не октябрь, факт будет показывать текущий месяц CRM.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Стоимость туров"
              actual={actuals.dealAmount}
              target={4_000_000}
              formatter={formatMoney}
              tone="navy"
              subtitle="Общая стоимость проданных туров за месяц. Цель офиса — 4 млн ₽."
            />
            <KpiCard
              title="Лиды"
              actual={actuals.leads}
              target={200}
              tone="blue"
              subtitle="План по рекламе Яндекса: 3–5 лидов в день, верхняя цель месяца — 200 лидов."
            />
            <KpiCard
              title="Конверсия"
              actual={actuals.conversion}
              target={30}
              formatter={(value) => `${value}%`}
              tone="green"
              subtitle="Цель по конверсии — 30%. Факт считается как продажи / входящие лиды."
            />
            <KpiCard
              title="Комиссия"
              actual={actuals.commission}
              target={200_000}
              formatter={formatMoney}
              tone="gold"
              subtitle="Бизнес-цель по комиссии офиса на месяц — 200 000 ₽."
            />
          </div>
        </Section>
      )}

      <Section title="График работы на октябрь" subtitle="Составлен с учётом договорённости: 1–3 октября работает Елена; Катина просьба закрыта на 1, 3, 5, 7, 18 и 25 октября; обязательные дни Елены 12, 15 и 19 октября закрывает Катя.">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {SCHEDULE_SUMMARY.map((item) => (
            <div key={item.title} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">{item.title}</p>
              <p className="mt-2 text-2xl font-bold text-navy">{item.value}</p>
              <p className="mt-1 text-xs leading-5 text-foreground/55">{item.note}</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-7 gap-2">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="px-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/40">
                  {label}
                </div>
              ))}
              {OCTOBER_SCHEDULE_WEEKS.flatMap((week, weekIndex) =>
                week.map((item, dayIndex) => (
                  <ScheduleCell key={`${weekIndex}-${dayIndex}-${item?.day ?? "empty"}`} item={item} />
                )),
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-foreground/55">
          <span className="rounded-full bg-blue-light/60 px-3 py-1 font-semibold text-blue">Елена</span>
          <span className="rounded-full bg-gold/15 px-3 py-1 font-semibold text-amber-700">Катя</span>
          <span className="rounded-full bg-white px-3 py-1">фикс. — уже согласованная смена</span>
          <span className="rounded-full bg-white px-3 py-1">день Кати / день Елены — учтённая личная договорённость</span>
        </div>
      </Section>

      <Section title="Соцсети и входящий поток" subtitle="Цели по росту аудитории и ежедневному контенту.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {SOCIAL_GOALS.map((goal) => (
            <GoalCard key={goal.title} icon={<Megaphone size={18} />} title={goal.title} target={goal.target} fact={goal.fact} note={goal.note} tone="blue" />
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title="Команда и мероприятия" subtitle="Развитие экспертности и публичной активности офиса.">
          <div className="grid grid-cols-1 gap-4">
            {DEVELOPMENT_GOALS.map((goal) => (
              <GoalCard key={goal.title} icon={goal.icon} title={goal.title} target={goal.target} note={goal.note} tone="gold" />
            ))}
          </div>
        </Section>

        <Section title="Сайт, продукт и витрина" subtitle="Что должно появиться в упаковке офиса к концу октября.">
          <div className="grid grid-cols-1 gap-4">
            {PRODUCT_GOALS.map((goal) => (
              <GoalCard key={goal.title} icon={goal.icon} title={goal.title} target={goal.target} note={goal.note} tone="navy" />
            ))}
          </div>
        </Section>
      </div>

      <Section title="Операционный чек-лист" subtitle="Что нужно контролировать еженедельно, чтобы цели не остались просто списком.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Проверять лиды из Яндекса и стоимость обращения",
            "Каждый день публиковать Instagram и Threads",
            "Подписывать входящие обращения на горящие туры",
            "Раз в неделю фиксировать факт по сертификатам, Египту, сайту и витринам",
            "Проверять конверсию и причины отказов",
            "Публиковать фото/посты по мероприятиям",
            "Обновлять базу знаний по Египту",
            "Подготовить QR-страницы для витрины",
          ].map((item) => (
            <div key={item} className="flex items-start gap-2 rounded-2xl bg-blue-light/35 p-3 text-sm leading-5 text-foreground/70">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-blue" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </Section>

      <div className="rounded-3xl border border-dashed border-black/10 bg-white/70 p-5 text-sm leading-6 text-foreground/55">
        <span className="font-semibold text-navy">Личные цели:</span> пока не заполнены. Когда продиктуешь личные цели, добавлю отдельный блок ниже офисных целей.
      </div>
    </div>
  );
}
