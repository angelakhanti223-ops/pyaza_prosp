import Image from "next/image";
import { ArrowRight, Phone } from "lucide-react";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";
import { siteImageUrl } from "@/lib/siteImagesApi";

type Props = {
  image?: string | null;
};

export default function Hero({ image }: Props) {
  const heroImage = siteImageUrl(image ?? null) ?? "/placeholders/hero.svg";

  return (
    <section className="overflow-hidden bg-gradient-to-b from-blue-light to-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-20">
        <div>
          <h1 className="text-4xl font-bold leading-tight text-navy sm:text-5xl">
            Туры и путёвки
            <br />
            от туристического
            <br />
            агентства в Пензе
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-foreground/70">
            Слетать.ру подбирает пляжный отдых, горящие туры, экскурсионные программы,
            семейные поездки и круизы по России и за рубежом — уже больше 20 лет.
            Берём на себя оформление документов, бронирование и поддержку 24/7:
            до, во время и после поездки.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <OpenLeadFormButton className="flex items-center gap-2 rounded-full bg-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue">
              Подобрать тур
              <ArrowRight size={17} />
            </OpenLeadFormButton>
            <a
              href="tel:+79502302555"
              className="flex items-center gap-2 rounded-full border border-navy/20 px-6 py-3.5 text-sm font-semibold text-navy transition-colors hover:bg-navy/5"
            >
              <Phone size={17} />
              Связаться с нами
            </a>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <div className="flex -space-x-3">
              {[1, 2, 3].map((seed) => (
                <Image
                  key={seed}
                  src={`/placeholders/avatar-${seed}.svg`}
                  alt="Клиент турагентства Слетать.ру, вернувшийся из путешествия"
                  width={40}
                  height={40}
                  unoptimized
                  className="rounded-full border-2 border-white object-cover"
                />
              ))}
            </div>
            <p className="max-w-[220px] text-xs text-foreground/60">
              Более 90 000 счастливых путешественников доверяют нам свой отдых
            </p>
          </div>
        </div>

        <div className="relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem]">
            <Image
              src={heroImage}
              alt="Пляжный отдых — тур, подобранный агентством Слетать.ру"
              fill
              priority
              unoptimized
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="absolute -bottom-6 -left-4 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-xl sm:-left-8">
            <span className="text-2xl font-bold text-gold">20+</span>
            <span className="max-w-[110px] text-xs leading-tight text-navy/70">
              лет создаём идеальные путешествия
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
