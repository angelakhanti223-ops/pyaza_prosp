import { ExternalLink } from "lucide-react";
import type { MideastMeta, Webinar } from "@/lib/mideastApi";

export default function SourcesTab({ webinars, meta }: { webinars: Webinar[]; meta: MideastMeta }) {
  const { rixos, dataset } = meta;

  return (
    <div className="flex flex-col gap-8">
      {rixos.brand_overview && (
        <div className="rounded-2xl border border-gold/30 bg-gold/10 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-dark">Бренд в фокусе</p>
          <h2 className="mt-1 text-xl font-bold text-navy">{rixos.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/80">{rixos.brand_overview}</p>

          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {rixos.concepts.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/40">Концепции</p>
                <ul className="flex flex-col gap-1 text-sm text-foreground/80">
                  {rixos.concepts.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-gold">•</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {rixos.kids_programs.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/40">Детские программы</p>
                <ul className="flex flex-col gap-1 text-sm text-foreground/80">
                  {rixos.kids_programs.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-gold">•</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {rixos.entertainment.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/40">Развлечения</p>
                <ul className="flex flex-col gap-1 text-sm text-foreground/80">
                  {rixos.entertainment.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-gold">•</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {rixos.hotels_list.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/40">Отели сети</p>
                <ul className="flex flex-col gap-1 text-sm text-foreground/80">
                  {rixos.hotels_list.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-gold">•</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold text-navy">Вебинары-источники</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Данные в базе собраны из записей курса ПАК Универ «Ближний Восток» и презентаций партнёров.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/5 bg-blue-light/40 text-xs text-foreground/50">
              <tr>
                <th className="px-4 py-3 font-medium">№</th>
                <th className="px-4 py-3 font-medium">Название</th>
                <th className="px-4 py-3 font-medium">Источник</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {webinars.map((w) => (
                <tr key={w.number} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-3 text-foreground/50">{w.number}</td>
                  <td className="px-4 py-3 font-medium text-navy">{w.title}</td>
                  <td className="px-4 py-3 text-foreground/60">{w.src || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {w.url && (
                      <a
                        href={w.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue hover:underline"
                      >
                        Открыть <ExternalLink size={12} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dataset.note && (
        <div className="rounded-2xl border border-black/5 bg-cream p-5 text-xs leading-relaxed text-foreground/60">
          <p>
            <span className="font-semibold text-foreground/70">Собрано:</span> {dataset.built} ·{" "}
            <span className="font-semibold text-foreground/70">Источник:</span> {dataset.source}
            {dataset.presentations_count > 0 && ` (${dataset.presentations_count} презентаций)`}
          </p>
          <p className="mt-2">{dataset.note}</p>
        </div>
      )}
    </div>
  );
}
