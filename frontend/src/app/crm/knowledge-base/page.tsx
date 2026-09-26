"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Gift, Globe2, Hotel, Phone, Search, UserRoundCheck } from "lucide-react";
import { listKnowledgeArticles, type KnowledgeArticleListItem } from "@/lib/crmApi";

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) => a.title.toLowerCase().includes(q) || (a.direction_name ?? "").toLowerCase().includes(q)
    );
  }, [articles, search]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">База знаний</h1>
          <p className="mt-1 text-sm text-foreground/50">
            Единая точка входа: направления, отели, кому предлагать, плюшки для агентов и контакты.
          </p>
        </div>
        <Link
          href="/crm/knowledge-base/new"
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue"
        >
          + Новая статья
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <Link
          href="/crm/kb/sea"
          className="rounded-2xl border border-gold/30 bg-gold/10 p-5 transition-shadow hover:shadow-md"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gold-dark">
                <Globe2 size={16} /> Специализированная база
              </p>
              <h2 className="mt-2 text-xl font-bold text-navy">ЮВА: страны, направления и отели</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/70">
                Карточки отелей в едином формате: кому предлагать, позиционирование, плюсы/минусы,
                плюшки для агентов, контакты отелей и представителей.
              </p>
            </div>
            <span className="rounded-full bg-navy px-3 py-1 text-xs font-semibold text-white">Открыть</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <span className="rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold text-navy">
              <Hotel size={14} className="mb-1" /> Отели
            </span>
            <span className="rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold text-navy">
              <UserRoundCheck size={14} className="mb-1" /> Кому предлагать
            </span>
            <span className="rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold text-navy">
              <Gift size={14} className="mb-1" /> Плюшки агенту
            </span>
            <span className="rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold text-navy">
              <Phone size={14} className="mb-1" /> Контакты
            </span>
          </div>
        </Link>

        <div className="rounded-2xl border border-black/5 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/40">Единый стандарт карточки отеля</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-foreground/70">
            <li>• для кого подходит / кому не предлагать;</li>
            <li>• агентские бонусы, комиссии, day pass, fam trip;</li>
            <li>• контакты отеля, сети или представителя;</li>
            <li>• что проверять перед продажей.</li>
          </ul>
        </div>
      </div>

      <div className="relative mb-5 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
        <input
          type="text"
          placeholder="Поиск по названию или направлению…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue"
        />
      </div>

      {loading ? (
        <p className="text-sm text-foreground/50">Загрузка…</p>
      ) : articles.length === 0 ? (
        <p className="text-sm text-foreground/40">Статей пока нет</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-foreground/40">Ничего не найдено по «{search}»</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((article) => (
            <Link
              key={article.id}
              href={`/crm/knowledge-base/${article.id}`}
              className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-white p-5 transition-colors hover:border-blue/30 hover:bg-blue-light/20"
            >
              <div className="flex items-center gap-2 text-blue">
                <BookOpen size={16} />
                {article.direction_name && (
                  <span className="text-xs font-medium uppercase tracking-wide">{article.direction_name}</span>
                )}
              </div>
              <h2 className="font-semibold text-navy">{article.title}</h2>
              <p className="mt-auto text-xs text-foreground/40">
                {article.author?.full_name && <>{article.author.full_name} · </>}
                {new Date(article.updated_at).toLocaleDateString("ru-RU")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
