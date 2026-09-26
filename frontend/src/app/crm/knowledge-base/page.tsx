"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Gift, Globe2, Hotel, Phone, Search, UserRoundCheck } from "lucide-react";
import { listKnowledgeArticles, type KnowledgeArticleListItem } from "@/lib/crmApi";

type BaseCard = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  description: string;
  kind: "special" | "article";
  sourceLabel: string;
  updatedAt?: string;
  tags: string[];
  keywords: string;
};

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "hotels", label: "Отели" },
  { id: "clients", label: "Кому предлагать" },
  { id: "perks", label: "Плюшки агентам" },
  { id: "contacts", label: "Контакты" },
  { id: "directions", label: "Направления" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const SPECIAL_BASES: BaseCard[] = [
  {
    id: "sea-special",
    href: "/crm/kb/sea",
    title: "ЮВА: страны, направления и отели",
    subtitle: "Специализированная база",
    description:
      "Отели ЮВА в едином формате: кому предлагать, кому не предлагать, позиционирование, плюсы/минусы, агентские плюшки и контакты представителей.",
    kind: "special",
    sourceLabel: "Страны · направления · отели",
    tags: ["Отели", "Кому предлагать", "Плюшки", "Контакты", "Направления"],
    keywords:
      "юва юго-восточная азия таиланд вьетнам индонезия отели направления страны кому предлагать кому не предлагать плюшки агентам контакты представители",
  },
];

function articleTags(article: KnowledgeArticleListItem): string[] {
  const text = `${article.title} ${article.direction_name ?? ""}`.toLowerCase();
  const tags: string[] = [];

  if (text.includes("отел")) tags.push("Отели");
  if (text.includes("мальдив")) tags.push("Мальдивы");
  if (text.includes("ближ") || text.includes("восток")) tags.push("Ближний Восток");
  if (text.includes("кому") || text.includes("предлаг")) tags.push("Кому предлагать");
  if (text.includes("плюш") || text.includes("бонус") || text.includes("комисс")) tags.push("Плюшки");
  if (text.includes("контакт")) tags.push("Контакты");
  if (article.direction_name) tags.push(article.direction_name);

  return [...new Set(tags.length ? tags : ["Статья"] )];
}

function articleDescription(article: KnowledgeArticleListItem): string {
  const title = article.title.toLowerCase();
  if (title.includes("отел")) {
    return "Карточки и заметки по отелям. Проверьте, чтобы внутри были: кому подходит, кому не предлагать, фишки, минусы, бонусы агенту и контакты.";
  }
  if (title.includes("мальдив")) {
    return "Материалы по Мальдивам: острова, резорты, сезонность, кому предлагать и что уточнять перед подбором.";
  }
  if (title.includes("восток")) {
    return "Материалы по Ближнему Востоку: отели, курорты, особенности продажи, контакты и условия для агентов.";
  }
  return "Внутренняя статья базы знаний. Используйте поиск внутри карточки, чтобы быстро найти отель, контакт, условие или рекомендацию.";
}

function matchesFilter(card: BaseCard, filter: FilterId): boolean {
  if (filter === "all") return true;
  const haystack = `${card.title} ${card.description} ${card.tags.join(" ")} ${card.keywords}`.toLowerCase();
  if (filter === "hotels") return haystack.includes("отел");
  if (filter === "clients") return haystack.includes("кому") || haystack.includes("предлаг");
  if (filter === "perks") return haystack.includes("плюш") || haystack.includes("бонус") || haystack.includes("комисс");
  if (filter === "contacts") return haystack.includes("контакт") || haystack.includes("представител");
  if (filter === "directions") return haystack.includes("направлен") || haystack.includes("страны") || haystack.includes("курорт");
  return true;
}

function formatDate(value?: string): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("ru-RU");
}

export default function CrmKnowledgeBasePage() {
  const [articles, setArticles] = useState<KnowledgeArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");

  useEffect(() => {
    listKnowledgeArticles().then((data) => {
      setArticles(data);
      setLoading(false);
    });
  }, []);

  const cards = useMemo<BaseCard[]>(() => {
    const articleCards = articles.map<BaseCard>((article) => ({
      id: `article-${article.id}`,
      href: `/crm/knowledge-base/${article.id}`,
      title: article.title,
      subtitle: article.direction_name ?? "База знаний",
      description: articleDescription(article),
      kind: "article",
      sourceLabel: [article.author?.full_name, formatDate(article.updated_at)].filter(Boolean).join(" · "),
      updatedAt: article.updated_at,
      tags: articleTags(article),
      keywords: `${article.title} ${article.direction_name ?? ""} ${articleTags(article).join(" ")}`,
    }));
    return [...SPECIAL_BASES, ...articleCards];
  }, [articles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((card) => {
      const searchable = `${card.title} ${card.subtitle} ${card.description} ${card.tags.join(" ")} ${card.keywords}`.toLowerCase();
      return matchesFilter(card, filter) && (!q || searchable.includes(q));
    });
  }, [cards, search, filter]);

  const stats = useMemo(() => {
    const hotels = cards.filter((card) => matchesFilter(card, "hotels")).length;
    const perks = cards.filter((card) => matchesFilter(card, "perks")).length;
    const contacts = cards.filter((card) => matchesFilter(card, "contacts")).length;
    return { total: cards.length, hotels, perks, contacts };
  }, [cards]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">База знаний</h1>
          <p className="mt-1 text-sm text-foreground/50">
            Внутренняя база турагентства: направления, отели, кому предлагать, плюшки для агентов и контакты.
          </p>
        </div>
        <Link
          href="/crm/knowledge-base/new"
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue"
        >
          + Новая статья
        </Link>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-black/5 bg-white p-4">
          <p className="text-xs text-foreground/40">Всего баз</p>
          <p className="mt-1 text-2xl font-bold text-navy">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-4">
          <p className="text-xs text-foreground/40">Есть отели</p>
          <p className="mt-1 text-2xl font-bold text-navy">{stats.hotels}</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-4">
          <p className="text-xs text-foreground/40">Плюшки агентам</p>
          <p className="mt-1 text-2xl font-bold text-navy">{stats.perks}</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-4">
          <p className="text-xs text-foreground/40">Контакты</p>
          <p className="mt-1 text-2xl font-bold text-navy">{stats.contacts}</p>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-black/5 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xl">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input
              type="text"
              placeholder="Поиск по базе: страна, отель, направление, бонус, контакт…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filter === item.id ? "bg-navy text-white" : "bg-blue-light/60 text-navy hover:bg-blue-light"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-foreground/40">
          Найдено: {filtered.length} из {cards.length}. Поиск работает по названию, направлению, тегам и смысловым пометкам базы.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-foreground/50">Загрузка…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-black/5 bg-white p-6 text-sm text-foreground/50">
          Ничего не найдено. Попробуй искать по стране, отелю, курорту, слову “контакты”, “плюшки” или “кому предлагать”.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className="flex min-h-[220px] flex-col rounded-2xl border border-black/5 bg-white p-5 transition-colors hover:border-blue/30 hover:bg-blue-light/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-blue">
                  <BookOpen size={17} />
                  <span className="text-xs font-semibold uppercase tracking-wide">{card.subtitle}</span>
                </div>
                {card.kind === "special" && (
                  <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-semibold text-gold-dark">
                    спецбаза
                  </span>
                )}
              </div>

              <h2 className="mt-3 text-lg font-bold leading-snug text-navy">{card.title}</h2>
              <p className="mt-2 line-clamp-4 text-sm leading-6 text-foreground/70">{card.description}</p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {card.tags.slice(0, 6).map((tag) => (
                  <span key={tag} className="rounded-full bg-blue-light px-2.5 py-1 text-[11px] font-medium text-navy">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-auto grid grid-cols-2 gap-2 pt-4 text-[11px] font-semibold text-navy/70">
                <span className="flex items-center gap-1 rounded-xl bg-cream px-2.5 py-2">
                  <Hotel size={13} /> отели
                </span>
                <span className="flex items-center gap-1 rounded-xl bg-cream px-2.5 py-2">
                  <UserRoundCheck size={13} /> кому
                </span>
                <span className="flex items-center gap-1 rounded-xl bg-cream px-2.5 py-2">
                  <Gift size={13} /> плюшки
                </span>
                <span className="flex items-center gap-1 rounded-xl bg-cream px-2.5 py-2">
                  <Phone size={13} /> контакты
                </span>
              </div>

              {card.sourceLabel && <p className="mt-3 text-xs text-foreground/40">{card.sourceLabel}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
