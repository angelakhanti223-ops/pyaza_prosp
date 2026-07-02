import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — Слетать.ру",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-navy sm:text-3xl">
        Политика конфиденциальности
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-foreground/70">
        Здесь будет опубликован полный текст политики обработки персональных
        данных «Слетать.ру» в соответствии с 152-ФЗ «О персональных данных».
        Текст согласовывается с заказчиком и будет добавлен перед запуском сайта.
      </p>
    </div>
  );
}
