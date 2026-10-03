"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type ArticleHeroSlide = {
  src: string;
  alt: string;
  title: string;
  description: string;
};

const CLEAN_IMAGE_SOURCES = {
  sea: "https://images.unsplash.com/photo-1676685309061-75cdbfd5f75f?auto=format&fit=crop&w=1600&q=85",
  family: "https://images.unsplash.com/photo-1769149255670-aa0ad6428dd6?auto=format&fit=crop&w=1600&q=85",
  city: "https://images.unsplash.com/photo-1665996977813-ee520a6608ea?auto=format&fit=crop&w=1600&q=85",
  villa: "https://images.unsplash.com/photo-1769389352398-f7b694034eb5?auto=format&fit=crop&w=1600&q=85",
};

function resolveImageSource(src: string) {
  if (src.includes("/blog/october/sea.")) return CLEAN_IMAGE_SOURCES.sea;
  if (src.includes("/blog/october/family.")) return CLEAN_IMAGE_SOURCES.family;
  if (src.includes("/blog/october/excursions.")) return CLEAN_IMAGE_SOURCES.city;
  if (src.includes("/blog/october/cruises.")) return CLEAN_IMAGE_SOURCES.villa;
  return src;
}

export default function ArticleHeroCarousel({ slides }: { slides: ArticleHeroSlide[] }) {
  const [index, setIndex] = useState(0);

  if (slides.length === 0) return null;

  const current = slides[index];
  const imageSrc = resolveImageSource(current.src);
  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length);
  const next = () => setIndex((i) => (i + 1) % slides.length);

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-blue-light bg-white shadow-sm">
      <div className="relative aspect-[16/9] bg-blue-light/40">
        <img
          src={imageSrc}
          alt={current.alt}
          className="h-full w-full object-cover"
          loading="eager"
          decoding="async"
        />

        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Предыдущий слайд"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-navy shadow hover:bg-white"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Следующий слайд"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-navy shadow hover:bg-white"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      <div className="bg-white p-5 sm:p-6">
        <p className="mb-2 inline-flex rounded-full bg-blue-light px-3 py-1 text-xs font-semibold text-blue">
          Идея для отдыха
        </p>
        <h2 className="text-xl font-bold text-navy sm:text-2xl">{current.title}</h2>
        <p className="mt-2 text-sm leading-6 text-foreground/70 sm:text-base">{current.description}</p>

        {slides.length > 1 && (
          <div className="mt-4 flex gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={slide.src}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Слайд ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-7 bg-blue" : "w-2 bg-blue-light"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
