"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award } from "lucide-react";
import { listCrmCertificates, mediaUrl, type CertificateCrm } from "@/lib/crmApi";

export default function CrmCertificatesPage() {
  const [certificates, setCertificates] = useState<CertificateCrm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCrmCertificates().then((data) => {
      setCertificates(data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-navy">Сертификаты</h1>
        <Link
          href="/crm/certificates/new"
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue"
        >
          + Новый сертификат
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-foreground/50">Загрузка…</p>
      ) : certificates.length === 0 ? (
        <p className="text-sm text-foreground/40">Сертификатов пока нет</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {certificates.map((cert) => (
            <Link
              key={cert.id}
              href={`/crm/certificates/${cert.id}`}
              className="overflow-hidden rounded-2xl border border-black/5 bg-white transition-colors hover:border-blue/30 hover:bg-blue-light/20"
            >
              {cert.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(cert.image)} alt={cert.title} className="h-32 w-full object-cover" />
              ) : (
                <div className="flex h-32 w-full items-center justify-center bg-blue-light text-blue">
                  <Award size={24} />
                </div>
              )}
              <div className="p-3">
                <h2 className="truncate text-sm font-semibold text-navy">{cert.title}</h2>
                {!cert.is_active && (
                  <span className="mt-1 inline-block rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-foreground/50">
                    Скрыт с сайта
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
