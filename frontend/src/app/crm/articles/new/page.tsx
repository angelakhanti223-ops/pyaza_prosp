"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createCrmArticle, type ArticleCrmInput } from "@/lib/crmApi";
import ArticleForm from "@/components/crm/ArticleForm";

export default function CrmNewArticlePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(input: ArticleCrmInput) {
    setSaving(true);
    try {
      const article = await createCrmArticle(input);
      router.push(`/crm/articles/${article.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => router.push("/crm/articles")}
        className="mb-4 flex items-center gap-1 text-sm text-foreground/50 hover:text-navy"
      >
        <ArrowLeft size={15} />
        Статьи
      </button>

      <div className="max-w-2xl rounded-2xl border border-black/5 bg-white p-6 sm:p-8">
        <h1 className="mb-5 text-xl font-bold text-navy">Новая статья</h1>
        <ArticleForm onSubmit={handleSubmit} submitLabel="Создать статью" saving={saving} />
      </div>
    </div>
  );
}
