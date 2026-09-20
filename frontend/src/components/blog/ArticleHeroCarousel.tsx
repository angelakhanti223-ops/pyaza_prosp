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
    <div className="relative mt-6 overflow-hidden rounded-3xl bg-blue-light/50 shadow-sm">
      <div className="relative aspect-[16/9]">
        <Image
          src={current.src}
          alt={current.alt}
          fill
          sizes="768px"
          className="object-cover"
          unoptimized
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/80 via-navy/25 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-5 text-white sm:p-7">
          <p className="mb-2 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
            Идея для отдыха
          </p>
          <h2 className="max-w-xl text-xl font-bold sm:text-2xl">{current.title}</h2>
          <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">{current.description}</p>
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Предыдущий слайд"
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-navy shadow hover:bg-white"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Следующий слайд"
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-navy shadow hover:bg-white"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={slide.src}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Слайд ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
