const STATS = [
  { value: "20+", label: "лет на рынке туризма" },
  { value: "90 000+", label: "довольных путешественников" },
  { value: "50+", label: "направлений по всему миру" },
  { value: "4.9", label: "средний рейтинг на Яндексе" },
];

export default function StatsBand() {
  return (
    <section className="bg-navy">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
        {STATS.map((stat) => (
          <div key={stat.label} className="text-center lg:text-left">
            <p className="text-4xl font-bold text-gold sm:text-5xl">{stat.value}</p>
            <p className="mt-2 text-xs text-white/60 sm:text-sm">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
