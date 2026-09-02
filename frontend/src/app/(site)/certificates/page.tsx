import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import OpenLeadFormButton from "@/components/lead-form/OpenLeadFormButton";
import { fetchCertificates } from "@/lib/api";
import { mediaUrl } from "@/lib/articlesApi";

export const metadata: Metadata = {
  title: "Сертификаты и квалификация — Слетать.ру в Пензе",
  description:
    "Подтверждённая квалификация специалистов турагентства Слетать.ру: сертификаты, дипломы и профессиональные аттестации.",
};

export default async function CertificatesPage() {
  const certificates = await fetchCertificates();

  return (
    <div>
      <PageHero
        title="Сертификаты и квалификация"
        text="Наши специалисты регулярно проходят обучение и аттестацию — вот подтверждения."
      />
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        {certificates.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {certificates.map((cert) => (
              <div key={cert.id} className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(cert.image) ?? ""} alt={cert.title} className="h-56 w-full object-cover" />
                <div className="p-4">
                  <h2 className="font-semibold text-navy">{cert.title}</h2>
                  {cert.description && (
                    <p className="mt-1 text-sm leading-relaxed text-foreground/60">{cert.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-foreground/50">Сертификаты скоро появятся здесь.</p>
        )}
        <div className="mt-12 text-center">
          <OpenLeadFormButton className="rounded-full bg-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue">
            Подобрать тур
          </OpenLeadFormButton>
        </div>
      </div>
    </div>
  );
}
