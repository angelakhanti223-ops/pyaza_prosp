"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { deleteCrmTeamMember, getCrmTeamMember, updateCrmTeamMember, type TeamMemberCrm, type TeamMemberInput } from "@/lib/crmApi";
import TeamMemberForm from "@/components/crm/TeamMemberForm";

export default function CrmTeamMemberPage() {
  const params = useParams<{ id: string }>();
  const memberId = Number(params.id);
  const router = useRouter();

  const [member, setMember] = useState<TeamMemberCrm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getCrmTeamMember(memberId).then((data) => {
      if (active) {
        setMember(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [memberId]);

  async function handleSubmit(input: TeamMemberInput) {
    setSaving(true);
    try {
      const updated = await updateCrmTeamMember(memberId, input);
      setMember(updated);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Удалить сотрудника со страницы «Команда»?")) return;
    await deleteCrmTeamMember(memberId);
    router.push("/crm/team");
  }

  if (loading) return <p className="text-sm text-foreground/50">Загрузка…</p>;
  if (!member) return <p className="text-sm text-foreground/50">Сотрудник не найден.</p>;

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
        <div className="mb-5 flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold text-navy">{member.name}</h1>
          <button
            onClick={handleDelete}
            aria-label="Удалить"
            className="flex h-8 w-8 items-center justify-center rounded-full text-navy/50 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={16} />
          </button>
        </div>
        <TeamMemberForm initial={member} onSubmit={handleSubmit} submitLabel="Сохранить" saving={saving} />
      </div>
    </div>
  );
}
