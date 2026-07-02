import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Пользовательское соглашение — Слетать.ру",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-navy sm:text-3xl">
        Пользовательское соглашение
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-foreground/70">
        Здесь будет опубликован полный текст пользовательского соглашения
        сайта «Слетать.ру». Текст согласовывается с заказчиком и будет
        добавлен перед запуском сайта.
      </p>
    </div>
  );
}
