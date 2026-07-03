const FAQ_ITEMS = [
  {
    question: "Как забронировать тур через Слетать.ру?",
    answer:
      "Оставьте заявку на сайте или позвоните нам — менеджер уточнит бюджет, даты и пожелания, подберёт варианты, а после вашего согласия зафиксирует цену и оформит бронь. Оплата и документы — на последнем шаге.",
  },
  {
    question: "Сколько стоит подбор тура у турагентства?",
    answer:
      "Подбор и консультация бесплатны. Вы оплачиваете только стоимость самого тура или путёвки — без скрытых платежей и навязанных дополнительных услуг.",
  },
  {
    question: "Вы работаете только в Пензе или онлайн по всей России?",
    answer:
      "Оба варианта: онлайн-заявку можно оставить из любого города России, а если вы в Пензе — приходите в офис на Пр-те Строителей, 49А, ТЦ «Проспект».",
  },
  {
    question: "Что делать, если во время поездки возникнут проблемы?",
    answer:
      "Мы остаёмся на связи 24/7 на протяжении всей поездки — от вылета до возвращения — и оперативно решаем любые нештатные ситуации.",
  },
  {
    question: "Какие виды туров вы подбираете?",
    answer:
      "Пляжный отдых, горящие туры, экскурсионные программы, семейные поездки, морские и речные круизы, а также индивидуальные маршруты под ваш запрос.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export default function Faq() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <h2 className="text-center text-2xl font-bold text-navy sm:text-3xl">Частые вопросы</h2>
      <div className="mt-8 flex flex-col gap-3">
        {FAQ_ITEMS.map((item) => (
          <details
            key={item.question}
            className="rounded-2xl border border-black/5 bg-white p-5 open:shadow-sm"
          >
            <summary className="cursor-pointer list-none text-sm font-semibold text-navy marker:content-none">
              {item.question}
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-foreground/60">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
