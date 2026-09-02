"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import {
  deleteCrmCertificate,
  getCrmCertificate,
  updateCrmCertificate,
  type CertificateCrm,
  type CertificateInput,
} from "@/lib/crmApi";
import CertificateForm from "@/components/crm/CertificateForm";

export default function CrmCertificatePage() {
  const params = useParams<{ id: string }>();
  const certId = Number(params.id);
  const router = useRouter();

  const [certificate, setCertificate] = useState<CertificateCrm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getCrmCertificate(certId).then((data) => {
      if (active) {
        setCertificate(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [certId]);

  async function handleSubmit(input: CertificateInput) {
    setSaving(true);
    try {
      const updated = await updateCrmCertificate(certId, input);
      setCertificate(updated);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Удалить сертификат со страницы «Сертификаты»?")) return;
    await deleteCrmCertificate(certId);
    router.push("/crm/certificates");
  }

  if (loading) return <p className="text-sm text-foreground/50">Загрузка…</p>;
  if (!certificate) return <p className="text-sm text-foreground/50">Сертификат не найден.</p>;

  return (
    <div>
      <button
        onClick={() => router.push("/crm/certificates")}
        className="mb-4 flex items-center gap-1 text-sm text-foreground/50 hover:text-navy"
      >
        <ArrowLeft size={15} />
        Сертификаты
      </button>

      <div className="max-w-xl rounded-2xl border border-black/5 bg-white p-6 sm:p-8">
        <div className="mb-5 flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold text-navy">{certificate.title}</h1>
          <button
            onClick={handleDelete}
            aria-label="Удалить"
            className="flex h-8 w-8 items-center justify-center rounded-full text-navy/50 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={16} />
          </button>
        </div>
        <CertificateForm initial={certificate} onSubmit={handleSubmit} submitLabel="Сохранить" saving={saving} />
      </div>
    </div>
  );
}
