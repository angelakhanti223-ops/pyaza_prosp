"use client";

import { useEffect, useRef, useState } from "react";
import {
  ARTICLE_STATUS_OPTIONS,
  createArticleCategory,
  listArticleCategoriesForCrm,
  mediaUrl,
  type ArticleCrmDetail,
  type ArticleCrmInput,
  type ArticleStatus,
} from "@/lib/crmApi";
import type { ArticleCategory } from "@/lib/articlesApi";
import RichTextEditor from "./RichTextEditor";

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ArticleForm({
  initial,
  onSubmit,
  submitLabel,
  saving,
}: {
  initial?: ArticleCrmDetail;
  onSubmit: (input: ArticleCrmInput) => Promise<void>;
  submitLabel: string;
  saving: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string>(initial?.category ? String(initial.category) : "");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [tagsInput, setTagsInput] = useState(initial?.tags.map((t) => t.name).join(", ") ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [status, setStatus] = useState<ArticleStatus>(initial?.status ?? "draft");
  const [publishedAt, setPublishedAt] = useState(toLocalInputValue(initial?.published_at ?? null));
  const [seoTitle, setSeoTitle] = useState(initial?.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(initial?.seo_description ?? "");
  const [featuredImage, setFeaturedImage] = useState<File | null>(null);
  const [ogImage, setOgImage] = useState<File | null>(null);
  const [error, setError] = useState("");
  const featuredImageInputRef = useRef<HTMLInputElement>(null);
  const ogImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listArticleCategoriesForCrm().then(setCategories);
  }, []);

  async function handleCreateCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const category = await createArticleCategory(name);
    setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name, "ru")));
    setCategoryId(String(category.id));
    setNewCategoryName("");
    setAddingCategory(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await onSubmit({
        title,
        slug: slug || undefined,
        category: categoryId ? Number(categoryId) : null,
        tag_names: tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        excerpt,
        content,
        featured_image: featuredImage,
        status,
        published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
        seo_title: seoTitle,
        seo_description: seoDescription,
        og_image: ogImage,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить статью");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs text-foreground/50">Заголовок</label>
        <input
          required
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-navy outline-none focus:border-blue"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-foreground/50">
          Адрес страницы (slug){!initial && " — можно оставить пустым, сгенерируется из заголовка"}
        </label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="top-10-plyazhey-tailanda"
          className="w-full rounded-lg border border-black/10 px-3 py-2 font-mono text-xs text-navy outline-none focus:border-blue"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-foreground/50">Категория</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue sm:w-56"
          >
            <option value="">Без категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {addingCategory ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              placeholder="Название категории"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
            />
            <button
              type="button"
              onClick={handleCreateCategory}
              className="rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-blue"
            >
              Добавить
            </button>
            <button
              type="button"
              onClick={() => setAddingCategory(false)}
              className="text-xs text-foreground/50 hover:text-navy"
            >
              Отмена
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingCategory(true)}
            className="mb-0.5 text-xs font-medium text-blue hover:underline"
          >
            + новая категория
          </button>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs text-foreground/50">Теги (через запятую)</label>
        <input
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Пляжи, Турция, Всё включено"
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-foreground/50">Краткое описание (для карточки в списке)</label>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-foreground/50">Текст статьи</label>
        <RichTextEditor value={content} onChange={setContent} />
      </div>

      <div>
        <label className="mb-1 block text-xs text-foreground/50">Обложка</label>
        {initial?.featured_image && !featuredImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(initial.featured_image)} alt="" className="mb-2 h-32 rounded-lg object-cover" />
        )}
        <input
          ref={featuredImageInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => setFeaturedImage(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-foreground/50">Статус</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ArticleStatus)}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue sm:w-48"
          >
            {ARTICLE_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-foreground/50">Дата публикации (пусто — сейчас)</label>
          <input
            type="datetime-local"
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
          />
        </div>
      </div>

      <div className="rounded-xl border border-black/5 bg-blue-light/10 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground/50">SEO</p>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs text-foreground/50">SEO-заголовок (title, пусто — берётся заголовок статьи)</label>
            <input
              type="text"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-foreground/50">SEO-описание (meta description)</label>
            <textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-foreground/50">Картинка для соцсетей (Open Graph)</label>
            {initial?.og_image && !ogImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(initial.og_image)} alt="" className="mb-2 h-24 rounded-lg object-cover" />
            )}
            <input
              ref={ogImageInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setOgImage(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue disabled:opacity-60"
      >
        {saving ? "Сохраняем…" : submitLabel}
      </button>
    </form>
  );
}
