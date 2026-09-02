"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createCrmCertificate, type CertificateInput } from "@/lib/crmApi";
import CertificateForm from "@/components/crm/CertificateForm";

export default function CrmNewCertificatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(input: CertificateInput) {
    setSaving(true);
    try {
      const cert = await createCrmCertificate(input);
      router.push(`/crm/certificates/${cert.id}`);
    } finally {
      setSaving(false);
    }
  }

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
        <h1 className="mb-5 text-xl font-bold text-navy">Новый сертификат</h1>
        <CertificateForm onSubmit={handleSubmit} submitLabel="Добавить" saving={saving} />
      </div>
    </div>
  );
}
