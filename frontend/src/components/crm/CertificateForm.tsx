"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { mediaUrl, type CertificateCrm, type CertificateInput } from "@/lib/crmApi";

export default function CertificateForm({
  initial,
  onSubmit,
  submitLabel,
  saving,
}: {
  initial?: CertificateCrm;
  onSubmit: (input: CertificateInput) => Promise<void>;
  submitLabel: string;
  saving: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await onSubmit({ title, description, order, is_active: isActive, image });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs text-foreground/50">Название</label>
        <input
          required
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-navy outline-none focus:border-blue"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-foreground/50">Скан/фото сертификата (изображение или PDF)</label>
        {initial?.image && !image && (
          initial.image.toLowerCase().endsWith(".pdf") ? (
            <a
              href={mediaUrl(initial.image)}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-2 flex items-center gap-1 text-sm text-blue hover:underline"
            >
              <FileText size={16} />
              Текущий PDF-файл
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(initial.image)} alt="" className="mb-2 h-32 rounded-lg object-cover" />
          )
        )}
        <input
          required={!initial}
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-foreground/50">Описание (необязательно)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-foreground/50">Порядок отображения</label>
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            className="w-24 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
          />
        </div>
        <label className="mb-2 flex items-center gap-2 text-sm text-foreground/70">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-black/20"
          />
          Показывать на сайте
        </label>
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
