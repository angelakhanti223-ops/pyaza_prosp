"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";

const REVIEWS = [
  {
    name: "Ольга",
    city: "г. Пенза",
    avatar: 1,
    text: "Брали тур в Турцию через Слетать.ру — идеально подобрали отель, всё чётко организовано. Спасибо за заботу и внимание!",
  },
  {
    name: "Дмитрий",
    city: "г. Пенза",
    avatar: 2,
    text: "Помогли выбрать круиз для всей семьи — учли все пожелания, ответили на все вопросы. Поедем ещё не раз.",
  },
  {
    name: "Анна",
    city: "г. Пенза",
    avatar: 3,
    text: "Очень внимательные менеджеры, всегда на связи. Отдых прошёл без единой заминки.",
  },
];

export default function ReviewsCarousel() {
  const [index, setIndex] = useState(0);
  const review = REVIEWS[index];

  const prev = () => setIndex((i) => (i - 1 + REVIEWS.length) % REVIEWS.length);
  const next = () => setIndex((i) => (i + 1) % REVIEWS.length);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex text-gold">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={14} fill="currentColor" strokeWidth={0} />
          ))}
        </div>
        <span className="text-sm font-semibold text-navy">5.0</span>
        <span className="text-xs text-foreground/50">Яндекс</span>
      </div>
      <p className="mt-3 text-xs font-semibold text-navy">Нас рекомендуют</p>

      <div className="mt-3 flex flex-1 items-start gap-3">
        <Image
          src={`/placeholders/avatar-${review.avatar}.svg`}
          alt={review.name}
          width={36}
          height={36}
          unoptimized
          className="rounded-full object-cover"
        />
        <div>
          <p className="text-xs font-semibold text-navy">
            {review.name}, {review.city}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-foreground/60">{review.text}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1.5">
          {REVIEWS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-gold" : "bg-black/10"}`}
            />
          ))}
        </div>
        <div className="flex gap-1">
          <button
            onClick={prev}
            aria-label="Предыдущий отзыв"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 text-navy/60 hover:bg-blue-light"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={next}
            aria-label="Следующий отзыв"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 text-navy/60 hover:bg-blue-light"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
