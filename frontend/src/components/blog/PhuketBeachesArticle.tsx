"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, ArrowUpRight } from "lucide-react";
import LeadForm from "@/components/lead-form/LeadForm";
import guide from "@/content/phuket-beaches.json";

type Beach = (typeof guide.beaches)[number];
type Hotel = (typeof guide.hotels)[number];
const controlClass = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-light bg-white text-navy shadow-sm transition hover:bg-blue-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue";
const proseClass = "prose prose-sm max-w-none text-foreground/80 prose-headings:text-navy prose-a:text-blue prose-table:table-fixed prose-td:break-words";

function BeachCarousel({ beach }: { beach: Beach }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const move = (direction: number) => setIndex((value) => (value + direction + beach.images.length) % beach.images.length);

  return (
    <section className="mt-12 overflow-hidden rounded-3xl border border-blue-light bg-white shadow-sm" aria-label={`Иллюстрации пляжа ${beach.name}`} aria-roledescription="карусель">
      <div
        className="relative aspect-[16/9] touch-pan-y bg-blue-light/40"
        onTouchStart={(event) => { touchX.current = event.touches[0].clientX; }}
        onTouchEnd={(event) => {
          if (touchX.current === null) return;
          const distance = event.changedTouches[0].clientX - touchX.current;
          if (Math.abs(distance) > 45) move(distance < 0 ? 1 : -1);
          touchX.current = null;
        }}
        onTouchCancel={() => { touchX.current = null; }}
      >
        <Image src={beach.images[index].src} alt={beach.images[index].alt} fill sizes="(max-width: 768px) 100vw, 704px" className="object-cover" unoptimized draggable={false} />
        <button type="button" onClick={() => move(-1)} aria-label={`Предыдущая иллюстрация: ${beach.name}`} className={`${controlClass} absolute left-3 top-1/2 -translate-y-1/2`}><ChevronLeft size={20} /></button>
        <button type="button" onClick={() => move(1)} aria-label={`Следующая иллюстрация: ${beach.name}`} className={`${controlClass} absolute right-3 top-1/2 -translate-y-1/2`}><ChevronRight size={20} /></button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-navy">{beach.name} · {beach.subtitle}</p>
          <p className="mt-1 text-xs text-foreground/50">Сгенерированные иллюстрации пляжа</p>
        </div>
        <div className="flex items-center gap-2">
          {beach.images.map((slide, number) => (
            <button key={slide.src} type="button" onClick={() => setIndex(number)} aria-label={`${beach.name}: иллюстрация ${number + 1}`} aria-current={index === number ? "true" : undefined} className={`h-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ${index === number ? "w-7 bg-blue" : "w-3 bg-blue-light"}`} />
          ))}
          <span className="ml-1 text-xs text-foreground/50" aria-live="polite">{index + 1} / {beach.images.length}</span>
        </div>
      </div>
    </section>
  );
}

function HotelCarousel({ beach, onSelect }: { beach: Beach; onSelect: (hotel: Hotel) => void }) {
  const list = useRef<HTMLUListElement>(null);
  const [position, setPosition] = useState({ start: true, end: false });
  const updatePosition = () => {
    const element = list.current;
    if (element) setPosition({ start: element.scrollLeft < 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
  };
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    const observer = new ResizeObserver(updatePosition);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const scroll = (direction: number) => {
    const element = list.current;
    if (!element) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ left: direction * element.clientWidth * 0.9, behavior: reducedMotion ? "instant" : "smooth" });
  };

  return (
    <section className="mt-6" aria-label={`Рекомендуемые отели: ${beach.name}`} aria-roledescription="карусель">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-navy">Где остановиться · {beach.name}</h3>
          <p className="mt-1 text-xs leading-5 text-foreground/60">Нажмите на фото — откроется описание отеля и заявка на бронирование.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => scroll(-1)} disabled={position.start} aria-label={`Предыдущие отели: ${beach.name}`} className={`${controlClass} disabled:cursor-default disabled:opacity-35`}><ChevronLeft size={18} /></button>
          <button type="button" onClick={() => scroll(1)} disabled={position.end} aria-label={`Следующие отели: ${beach.name}`} className={`${controlClass} disabled:cursor-default disabled:opacity-35`}><ChevronRight size={18} /></button>
        </div>
      </div>
      <ul ref={list} onScroll={updatePosition} className="m-0 flex list-none snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-1 pb-4 pt-1" tabIndex={0} aria-label={`Четыре отеля у ${beach.name}`}>
        {beach.hotels.map((id) => {
          const hotel = guide.hotels.find((item) => item.id === id)!;
          return (
            <li key={id} className="w-[84%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)]">
              <button type="button" onClick={() => onSelect(hotel)} aria-label={`Подробнее об отеле ${hotel.name}`} className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-blue-light bg-white text-left shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue" data-hotel={id}>
                <div className="relative aspect-[3/2] w-full overflow-hidden bg-blue-light/40">
                  <Image src={hotel.image} alt={hotel.imageAlt} fill sizes="(max-width: 639px) 84vw, 340px" className="object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transform-none" unoptimized />
                  <span className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-navy"><ArrowUpRight size={18} /></span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-blue">{hotel.tagline}</p>
                  <h4 className="mt-2 text-base font-bold leading-6 text-navy">{hotel.name}</h4>
                  <p className="mt-2 text-xs leading-5 text-foreground/70">{hotel.fit}</p>
                  <span className="mt-4 block text-xs font-semibold text-blue">Описание и бронирование →</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-[11px] leading-5 text-foreground/50">Иллюстрации по фотографиям отелей. Фактический номер и вид зависят от выбранной категории.</p>
    </section>
  );
}

function HotelDialog({ hotel, onClose }: { hotel: Hotel; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const bookingArea = useRef<HTMLDivElement>(null);
  const [booking, setBooking] = useState(false);
  const beach = guide.beaches.find((item) => item.id === hotel.beach)!;

  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = oldOverflow;
      opener?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (booking) {
      bookingArea.current?.scrollIntoView({ block: "start" });
      bookingArea.current?.querySelector("input")?.focus({ preventScroll: true });
    }
  }, [booking]);

  return (
    <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="phuket-hotel-title" className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-3xl border-0 bg-white p-0 text-foreground shadow-2xl backdrop:bg-navy-dark/65">
      <div>
        <div className="sticky top-3 z-10 mr-3 flex h-0 justify-end">
          <button type="button" autoFocus onClick={onClose} aria-label="Закрыть описание отеля" className={controlClass}><X size={20} /></button>
        </div>
        <div className="relative aspect-[16/9] bg-blue-light/40">
          <Image src={hotel.image} alt={hotel.imageAlt} fill sizes="(max-width: 768px) 100vw, 672px" className="object-cover" unoptimized />
        </div>
        <div className="p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue">Пхукет · {beach.name}</p>
          <h2 id="phuket-hotel-title" className="mt-2 text-2xl font-bold leading-tight text-navy">{hotel.name}</h2>
          <p className="mt-4 text-sm leading-6 text-foreground/80">{hotel.description}</p>
          <div className="mt-5 rounded-2xl bg-blue-light/50 p-4">
            <h3 className="text-sm font-bold text-navy">Кому подойдёт</h3>
            <p className="mt-2 text-sm leading-6">{hotel.fit}</p>
            <h3 className="mt-4 text-sm font-bold text-navy">Как расположен относительно пляжа</h3>
            <p className="mt-2 text-sm leading-6">{hotel.beachAccess}</p>
          </div>
          <div className="mt-4 rounded-2xl bg-[#fff7df] p-4 text-sm leading-6"><strong className="text-navy">Что учтём при подборе:</strong> {hotel.note}</div>
          <p className="mt-4 text-xs leading-5 text-foreground/50">Изображение — иллюстрация по фотографии отеля. Подтвердим категорию, актуальные условия и наличие на ваши даты.</p>
          <a href={hotel.source} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs text-blue underline underline-offset-4">{hotel.id === "mantra" ? "Карточка отеля и источник фотографии" : "Официальный сайт отеля"}</a>
          {!booking ? (
            <button type="button" onClick={() => setBooking(true)} className="mt-6 w-full rounded-full bg-navy px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue">Забронировать этот отель</button>
          ) : (
            <div ref={bookingArea} className="mt-6 border-t border-blue-light pt-5">
              <h3 className="text-lg font-bold text-navy">Заявка на бронирование</h3>
              <p className="mb-5 mt-2 text-sm leading-6 text-foreground/70">Укажите контакты и пожелания. Менеджер проверит наличие и стоимость; бронирование подтвердим после согласования условий.</p>
              <LeadForm initialComment={`Хочу забронировать ${hotel.name}. Пляж / район: ${beach.name}, Пхукет. Статья: ${guide.title}. Даты поездки, состав туристов и бюджет: `} />
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}

export default function PhuketBeachesArticle({ content }: { content: string }) {
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const parts = content.split(/<!-- phuket:(beach|hotels):([a-z-]+) -->/g);
  const blocks = [];
  for (let index = 0; index < parts.length; index += 3) {
    if (parts[index].trim()) blocks.push(<div key={`text-${index}`} className={`${proseClass} mt-8`} dangerouslySetInnerHTML={{ __html: parts[index] }} />);
    const kind = parts[index + 1];
    const beach = guide.beaches.find((item) => item.id === parts[index + 2]);
    if (kind && beach) blocks.push(kind === "beach" ? <BeachCarousel key={`beach-${beach.id}`} beach={beach} /> : <HotelCarousel key={`hotels-${beach.id}`} beach={beach} onSelect={setSelectedHotel} />);
  }
  return <>{blocks}{selectedHotel && <HotelDialog key={selectedHotel.id} hotel={selectedHotel} onClose={() => setSelectedHotel(null)} />}</>;
}
