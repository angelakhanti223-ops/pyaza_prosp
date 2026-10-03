"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type ArticleHeroSlide = {
  src: string;
  alt: string;
  title: string;
  description: string;
};

const imageUrl = (photoId: string) =>
  `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=1600&q=85`;

const SLIDE_IMAGE_SOURCES = {
  octoberSea: imageUrl("photo-1519046904884-53103b34b206"),
  octoberFamily: imageUrl("photo-1500530855697-b586d89ba3ee"),
  octoberCity: imageUrl("photo-1524231757912-21f4fe3a7200"),
  octoberRoute: imageUrl("photo-1500534623283-312aade485b7"),

  novemberCity: imageUrl("photo-1502602898657-3e91760cbb34"),
  novemberSea: imageUrl("photo-1519046904884-53103b34b206"),
  novemberFamily: imageUrl("photo-1510414842594-a61c69b5ae57"),
  novemberRoute: imageUrl("photo-1530789253388-582c481c54b0"),

  januarySea: imageUrl("photo-1507525428034-b723cf961d3e"),
  januaryFamily: imageUrl("photo-1500530855697-b586d89ba3ee"),
  januaryCity: imageUrl("photo-1524231757912-21f4fe3a7200"),
  januaryIsland: imageUrl("photo-1573843981267-be1999ff37cd"),

  decemberSea: imageUrl("photo-1512100356356-de1b84283e18"),
  decemberFamily: imageUrl("photo-1500530855697-b586d89ba3ee"),
  decemberCity: imageUrl("photo-1548013146-72479768bada"),
  decemberRoute: imageUrl("photo-1573843981267-be1999ff37cd"),

  autumnFamily: imageUrl("photo-1510414842594-a61c69b5ae57"),
  autumnSea: imageUrl("photo-1526772662000-3f88f10405ff"),
  autumnCity: imageUrl("photo-1519677100203-a0e668c92439"),
  autumnSpa: imageUrl("photo-1501785888041-af3ef285b470"),

  newYearCity: imageUrl("photo-1488646953014-85cb44e25828"),
  newYearSea: imageUrl("photo-1507525428034-b723cf961d3e"),
  newYearFamily: imageUrl("photo-1510414842594-a61c69b5ae57"),
  newYearIsland: imageUrl("photo-1512100356356-de1b84283e18"),
};

const LEGACY_IMAGE_SOURCES = {
  sea: SLIDE_IMAGE_SOURCES.januarySea,
  family: SLIDE_IMAGE_SOURCES.autumnFamily,
  city: SLIDE_IMAGE_SOURCES.novemberCity,
  villa: SLIDE_IMAGE_SOURCES.januaryIsland,
};

function resolveImageSource(slide: ArticleHeroSlide) {
  const key = `${slide.title} ${slide.alt}`.toLowerCase();

  if (key.includes("октябр") && key.includes("море")) return SLIDE_IMAGE_SOURCES.octoberSea;
  if (key.includes("октябр") && key.includes("сем")) return SLIDE_IMAGE_SOURCES.octoberFamily;
  if (key.includes("октябр") && key.includes("экскур")) return SLIDE_IMAGE_SOURCES.octoberCity;
  if (key.includes("октябр") && key.includes("круиз")) return SLIDE_IMAGE_SOURCES.octoberRoute;

  if (key.includes("ноябр") && key.includes("город")) return SLIDE_IMAGE_SOURCES.novemberCity;
  if (key.includes("ноябр") && key.includes("мор")) return SLIDE_IMAGE_SOURCES.novemberSea;
  if (key.includes("ноябр") && key.includes("сем")) return SLIDE_IMAGE_SOURCES.novemberFamily;
  if (key.includes("ноябр") && (key.includes("комбинирован") || key.includes("мест"))) return SLIDE_IMAGE_SOURCES.novemberRoute;

  if (key.includes("январ") && key.includes("море")) return SLIDE_IMAGE_SOURCES.januarySea;
  if (key.includes("январ") && key.includes("сем")) return SLIDE_IMAGE_SOURCES.januaryFamily;
  if (key.includes("январ") && key.includes("экскур")) return SLIDE_IMAGE_SOURCES.januaryCity;
  if (key.includes("январ") && (key.includes("остров") || key.includes("премиаль") || key.includes("отпуск"))) return SLIDE_IMAGE_SOURCES.januaryIsland;

  if (key.includes("декабр") && key.includes("пляж")) return SLIDE_IMAGE_SOURCES.decemberSea;
  if (key.includes("декабр") && key.includes("сем")) return SLIDE_IMAGE_SOURCES.decemberFamily;
  if (key.includes("новогодн") && key.includes("город")) return SLIDE_IMAGE_SOURCES.decemberCity;
  if (key.includes("зимний отдых") || key.includes("маршрут с впечатлениями")) return SLIDE_IMAGE_SOURCES.decemberRoute;

  if (key.includes("каникул") && key.includes("сем")) return SLIDE_IMAGE_SOURCES.autumnFamily;
  if (key.includes("каникул") && key.includes("море")) return SLIDE_IMAGE_SOURCES.autumnSea;
  if (key.includes("каникул") && key.includes("экскур")) return SLIDE_IMAGE_SOURCES.autumnCity;
  if (key.includes("spa") || key.includes("без суеты")) return SLIDE_IMAGE_SOURCES.autumnSpa;

  if (key.includes("новогодний формат")) return SLIDE_IMAGE_SOURCES.newYearCity;
  if (key.includes("тёплое море на новый год")) return SLIDE_IMAGE_SOURCES.newYearSea;
  if (key.includes("семейный отель на новый год")) return SLIDE_IMAGE_SOURCES.newYearFamily;
  if (key.includes("островной новогодний")) return SLIDE_IMAGE_SOURCES.newYearIsland;

  if (slide.src.includes("/blog/october/sea.")) return LEGACY_IMAGE_SOURCES.sea;
  if (slide.src.includes("/blog/october/family.")) return LEGACY_IMAGE_SOURCES.family;
  if (slide.src.includes("/blog/october/excursions.")) return LEGACY_IMAGE_SOURCES.city;
  if (slide.src.includes("/blog/october/cruises.")) return LEGACY_IMAGE_SOURCES.villa;
  return slide.src;
}

export default function ArticleHeroCarousel({ slides }: { slides: ArticleHeroSlide[] }) {
  const [index, setIndex] = useState(0);

  if (slides.length === 0) return null;

  const current = slides[index];
  const imageSrc = resolveImageSource(current);
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
                key={`${slide.title}-${i}`}
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
