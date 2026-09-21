import Image from "next/image";

type Props = {
  title: string;
  text: string;
  image?: string | null;
  imageAlt?: string;
};

export default function PageHero({ title, text, image, imageAlt }: Props) {
  return (
    <div className="bg-gradient-to-b from-blue-light to-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8 lg:py-16">
        <div className={image ? "text-left" : "mx-auto max-w-3xl text-center"}>
          <h1 className="text-3xl font-bold text-navy sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground/70">{text}</p>
        </div>

        {image && (
          <div className="relative aspect-[16/10] overflow-hidden rounded-[2rem] shadow-xl">
            <Image
              src={image}
              alt={imageAlt ?? title}
              fill
              priority
              unoptimized
              sizes="(max-width: 1024px) 100vw, 420px"
              className="object-cover"
            />
          </div>
        )}
      </div>
    </div>
  );
}
