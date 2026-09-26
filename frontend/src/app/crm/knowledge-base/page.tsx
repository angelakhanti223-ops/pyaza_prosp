"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { listKnowledgeArticles, type KnowledgeArticleListItem } from "@/lib/crmApi";

type KnowledgeCard = {
  key: string;
  href: string;
  title: string;
  label: string;
  description: string;
  chips: string[];
  meta?: string;
  searchText: string;
};

const seaKnowledgeCard: KnowledgeCard = {
  key: "sea-kb",
  href: "/crm/kb/sea",
  title: "База знаний: ЮВА",
  label: "ЮВА",
  description:
    "Страны, направления, отели, кому предлагать, кому не предлагать, плюшки для агентов и контакты отелей / представителей.",
  chips: ["Отели", "Кому предлагать", "Плюшки агенту", "Контакты"],
  meta: "Внутренняя база турагентства",
  searchText:
    "юва юго восточная азия страны направления отели кому предлагать плюшки агенту контакты представители",
};

function articleToCard(article: KnowledgeArticleListItem): KnowledgeCard {
  const label = article.direction_name ?? "База знаний";
  const author = article.author?.full_name ? `${article.author.full_name} · ` : "";
  return {
    key: `article-${article.id}`,
    href: `/crm/knowledge-base/${article.id}`,
    title: article.title,
    label,
    description:
      "Внутренняя статья для менеджеров: условия направления, отели, рекомендации по продаже и рабочие заметки.",
    chips: [label],
    meta: `${author}${new Date(article.updated_at).toLocaleDateString("ru-RU")}`,
    searchText: `${article.title} ${label}`.toLowerCase(),
  };
}

function KnowledgeBaseCard({ card }: { card: KnowledgeCard }) {
  return (
    <Link
      href={card.href}
      className="flex min-h-[190px] flex-col rounded-2xl border border-black/5 bg-white p-5 transition-colors hover:border-blue/30 hover:bg-blue-light/20"
    >
      <div className="mb-3 flex items-center gap-2 text-blue">
        <BookOpen size={16} />
        <span className="text-xs font-semibold uppercase tracking-wide">{card.label}</span>
      </div>

      <h2 className="text-base font-bold leading-snug text-navy">{card.title}</h2>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-foreground/70">{card.description}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {card.chips.map((chip) => (
          <span key={chip} className="rounded-full bg-blue-light px-2.5 py-1 text-[11px] font-medium text-navy">
            {chip}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        {card.meta && <p className="text-xs text-foreground/40">{card.meta}</p>}
        <span className="ml-auto rounded-full bg-navy px-3 py-1 text-xs font-semibold text-white">Открыть</span>
      </div>
    </Link>
  );
}

export default function CrmKnowledgeBasePage() {
  const [articles, setArticles] = useState<KnowledgeArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listKnowledgeArticles().then((data) => {
      setArticles(data);
      setLoading(false);
    });
  }, []);

  const cards = useMemo(() => [seaKnowledgeCard, ...articles.map(articleToCard)], [articles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((card) => card.searchText.toLowerCase().includes(q));
  }, [cards, search]);

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

      <div className="relative mb-5 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
        <input
          type="text"
          placeholder="Поиск по базе знаний, направлению или отелю…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue"
        />
      </div>

      {loading ? (
        <p className="text-sm text-foreground/50">Загрузка…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-foreground/40">Ничего не найдено по «{search}»</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((card) => (
            <KnowledgeBaseCard key={card.key} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}
