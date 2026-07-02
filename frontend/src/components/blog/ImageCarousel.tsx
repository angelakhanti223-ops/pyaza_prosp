"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { mediaUrl, type ArticleGalleryImage } from "@/lib/articlesApi";

export default function ImageCarousel({ images }: { images: ArticleGalleryImage[] }) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) return null;

  const current = images[index];
  const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);
  const next = () => setIndex((i) => (i + 1) % images.length);

  return (
    <div className="mt-10">
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-blue-light/40">
        <Image
          src={mediaUrl(current.image) ?? ""}
          alt={current.caption || "Изображение статьи"}
          fill
          sizes="768px"
          className="object-cover"
          unoptimized
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Предыдущее изображение"
              className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-navy shadow hover:bg-white"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Следующее изображение"
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-navy shadow hover:bg-white"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Изображение ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-5 bg-white" : "w-1.5 bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {current.caption && (
        <p className="mt-2 text-center text-xs text-foreground/50">{current.caption}</p>
      )}
    </div>
  );
}
