"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createCrmTeamMember, type TeamMemberInput } from "@/lib/crmApi";
import TeamMemberForm from "@/components/crm/TeamMemberForm";

export default function CrmNewTeamMemberPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(input: TeamMemberInput) {
    setSaving(true);
    try {
      const member = await createCrmTeamMember(input);
      router.push(`/crm/team/${member.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => router.push("/crm/team")}
        className="mb-4 flex items-center gap-1 text-sm text-foreground/50 hover:text-navy"
      >
        <ArrowLeft size={15} />
        Команда
      </button>

      <div className="max-w-xl rounded-2xl border border-black/5 bg-white p-6 sm:p-8">
        <h1 className="mb-5 text-xl font-bold text-navy">Новый сотрудник</h1>
        <TeamMemberForm onSubmit={handleSubmit} submitLabel="Добавить" saving={saving} />
      </div>
    </div>
  );
}
