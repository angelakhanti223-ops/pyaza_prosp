"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type ArticleHeroSlide = {
  src: string;
  alt: string;
  title: string;
  description: string;
};

export default function ArticleHeroCarousel({ slides }: { slides: ArticleHeroSlide[] }) {
  const [index, setIndex] = useState(0);

  if (slides.length === 0) return null;

  const current = slides[index];
  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length);
  const next = () => setIndex((i) => (i + 1) % slides.length);

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-blue-light bg-white shadow-sm">
      <div className="relative aspect-[16/9] bg-blue-light/40">
        <Image
          src={current.src}
          alt={current.alt}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
          unoptimized
          priority
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
