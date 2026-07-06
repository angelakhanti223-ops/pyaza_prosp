"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Paperclip } from "lucide-react";
import {
  addLeadComment,
  getLead,
  listManagers,
  mediaUrl,
  updateLead,
  uploadLeadAttachment,
  STATUS_OPTIONS,
  type CrmUser,
  type LeadDetail,
  type LeadStatus,
} from "@/lib/crmApi";
import { useCrmAuth } from "@/components/crm/CrmAuthProvider";
import StatusBadge from "@/components/crm/StatusBadge";

export default function CrmLeadDetailPage() {
  const params = useParams<{ id: string }>();
  const leadId = Number(params.id);
  const router = useRouter();
  const { user } = useCrmAuth();
  const isHead = user?.is_head ?? false;

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [managers, setManagers] = useState<CrmUser[]>([]);
  const [comment, setComment] = useState("");
  const [savingField, setSavingField] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getLead(leadId);
      setLead(data);
    } catch {
      setLead(null);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    let active = true;
    getLead(leadId)
      .then((data) => {
        if (active) setLead(data);
      })
      .catch(() => {
        if (active) setLead(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [leadId]);

  useEffect(() => {
    if (isHead) listManagers().then(setManagers);
  }, [isHead]);

  async function handleStatusChange(status: LeadStatus) {
    if (!lead) return;
    setSavingField("status");
    try {
      const updated = await updateLead(lead.id, { status });
      setLead(updated);
    } finally {
      setSavingField(null);
    }
  }

  async function handleManagerChange(managerId: string) {
    if (!lead) return;
    setSavingField("manager");
    try {
      const updated = await updateLead(lead.id, { assigned_manager: Number(managerId) });
      setLead(updated);
    } finally {
      setSavingField(null);
    }
  }

  async function handleDealFieldSave(field: "deal_amount" | "commission", value: string) {
    if (!lead) return;
    setSavingField(field);
    try {
      const updated = await updateLead(lead.id, { [field]: value || undefined });
      setLead(updated);
    } finally {
      setSavingField(null);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !comment.trim()) return;
    await addLeadComment(lead.id, comment.trim());
    setComment("");
    load();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!lead || !e.target.files?.length) return;
    await uploadLeadAttachment(lead.id, e.target.files[0]);
    e.target.value = "";
    load();
  }

  if (loading) {
    return <p className="text-sm text-foreground/50">Загрузка…</p>;
  }

  if (!lead) {
    return (
      <div>
        <p className="text-sm text-foreground/50">Заявка не найдена или недоступна.</p>
        <button onClick={() => router.push("/crm/leads")} className="mt-3 text-sm text-blue underline">
          Назад к списку
        </button>
      </div>
    );
  }

  type TimelineItem =
    | { kind: "comment"; date: string; data: LeadDetail["comments"][number] }
    | { kind: "status"; date: string; data: LeadDetail["status_history"][number] };

  const timeline: TimelineItem[] = [
    ...lead.comments.map((c) => ({ kind: "comment" as const, date: c.created_at, data: c })),
    ...lead.status_history.map((h) => ({ kind: "status" as const, date: h.changed_at, data: h })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div>
      <button
        onClick={() => router.push("/crm/leads")}
        className="mb-4 flex items-center gap-1 text-sm text-foreground/50 hover:text-navy"
      >
        <ArrowLeft size={15} />
        Все заявки
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-black/5 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-navy">{lead.name}</h1>
                <p className="mt-1 text-sm text-foreground/60">
                  {lead.phone}
                  {lead.email && <> · {lead.email}</>}
                </p>
                <p className="mt-1 text-xs text-foreground/40">
                  Источник: {lead.source_display}
                  {lead.direction_name && <> · {lead.direction_name}</>}
                </p>
              </div>
              <StatusBadge status={lead.status} label={lead.status_display} />
            </div>

            {lead.initial_comment && (
              <p className="mt-4 rounded-xl bg-blue-light/40 p-3 text-sm text-foreground/70">
                {lead.initial_comment}
              </p>
            )}

            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs text-foreground/50">Статус</label>
                <select
                  value={lead.status}
                  disabled={savingField === "status"}
                  onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
                  className="mt-1 w-full rounded-lg border border-black/10 px-2 py-1.5 text-sm outline-none focus:border-blue"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-foreground/50">Ответственный</label>
                {isHead ? (
                  <select
                    value={lead.assigned_manager?.id ?? ""}
                    disabled={savingField === "manager"}
                    onChange={(e) => handleManagerChange(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-black/10 px-2 py-1.5 text-sm outline-none focus:border-blue"
                  >
                    <option value="" disabled>
                      Не назначен
                    </option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1.5 text-sm text-navy">{lead.assigned_manager?.full_name ?? "—"}</p>
                )}
              </div>

              <div>
                <label className="text-xs text-foreground/50">Сумма сделки, ₽</label>
                <input
                  type="number"
                  defaultValue={lead.deal_amount ?? ""}
                  onBlur={(e) => handleDealFieldSave("deal_amount", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/10 px-2 py-1.5 text-sm outline-none focus:border-blue"
                />
              </div>

              <div>
                <label className="text-xs text-foreground/50">Комиссия, ₽</label>
                <input
                  type="number"
                  defaultValue={lead.commission ?? ""}
                  onBlur={(e) => handleDealFieldSave("commission", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/10 px-2 py-1.5 text-sm outline-none focus:border-blue"
                />
              </div>

              <div>
                <label className="text-xs text-foreground/50">ID обращения U-ON</label>
                <p className="mt-1.5 text-sm text-navy">{lead.uon_ticket_id || "не синхронизировано"}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-black/5 bg-white p-6">
            <h2 className="mb-3 text-sm font-semibold text-navy">История</h2>
            <form onSubmit={handleAddComment} className="mb-4 flex gap-2">
              <input
                type="text"
                placeholder="Добавить комментарий…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
              />
              <button
                type="submit"
                className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-blue"
              >
                Добавить
              </button>
            </form>

            <div className="flex flex-col gap-3">
              {timeline.map((item) => (
                <div key={`${item.kind}-${item.data.id}`} className="rounded-xl bg-blue-light/30 p-3 text-sm">
                  {item.kind === "comment" ? (
                    <p className="text-foreground/80">{item.data.text}</p>
                  ) : (
                    <p className="text-foreground/80">
                      Статус изменён:{" "}
                      <span className="font-medium">
                        {item.data.old_status_display || "—"} → {item.data.new_status_display}
                      </span>
                    </p>
                  )}
                  <p className="mt-1 text-xs text-foreground/40">
                    {"author" in item.data ? item.data.author?.full_name : item.data.changed_by?.full_name}
                    {" · "}
                    {new Date(item.date).toLocaleString("ru-RU")}
                  </p>
                </div>
              ))}
              {timeline.length === 0 && (
                <p className="text-sm text-foreground/40">Пока нет ни комментариев, ни изменений статуса.</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-2xl border border-black/5 bg-white p-6">
            <h2 className="mb-3 text-sm font-semibold text-navy">Файлы</h2>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-black/15 px-3 py-2.5 text-sm text-foreground/60 hover:border-blue hover:text-blue">
              <Paperclip size={15} />
              Прикрепить файл
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
            <ul className="mt-3 flex flex-col gap-2">
              {lead.attachments.map((a) => (
                <li key={a.id}>
                  <a
                    href={mediaUrl(a.file)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue underline underline-offset-2 hover:text-navy"
                  >
                    {a.file.split("/").pop()}
                  </a>
                </li>
              ))}
              {lead.attachments.length === 0 && (
                <p className="text-xs text-foreground/40">Файлов пока нет</p>
              )}
            </ul>
          </div>

          <div className="mt-6 rounded-2xl border border-black/5 bg-white p-6">
            <h2 className="mb-3 text-sm font-semibold text-navy">Связанные задачи</h2>
            <ul className="flex flex-col gap-2">
              {lead.tasks.map((t) => (
                <li key={t.id} className="rounded-xl bg-blue-light/30 p-3 text-sm">
                  <p className="font-medium text-navy">{t.title}</p>
                  <p className="text-xs text-foreground/50">
                    {t.column}
                    {t.deadline && <> · до {new Date(t.deadline).toLocaleDateString("ru-RU")}</>}
                  </p>
                </li>
              ))}
              {lead.tasks.length === 0 && (
                <p className="text-xs text-foreground/40">Задач на канбан-доске пока нет</p>
              )}
            </ul>
          </div>

          {lead.uon_request && (
            <div className="mt-6 rounded-2xl border border-black/5 bg-white p-6">
              <h2 className="mb-3 text-sm font-semibold text-navy">Заявка в U-ON</h2>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-foreground/50">Статус в U-ON</dt>
                  <dd className="font-medium text-navy">{lead.uon_request.status_name || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-foreground/50">Менеджер в U-ON</dt>
                  <dd className="text-navy">{lead.uon_request.manager_name || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-foreground/50">Номер брони</dt>
                  <dd className="text-navy">{lead.uon_request.reservation_number || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-foreground/50">В архиве</dt>
                  <dd className="text-navy">{lead.uon_request.is_archive ? "Да" : "Нет"}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-foreground/40">
                Обновлено: {new Date(lead.uon_request.synced_at).toLocaleString("ru-RU")}
              </p>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-black/5 bg-white p-6">
            <h2 className="mb-3 text-sm font-semibold text-navy">Синхронизация с U-ON</h2>
            <ul className="flex flex-col gap-2">
              {lead.uon_sync_logs.map((log) => (
                <li key={log.id} className="rounded-xl bg-blue-light/30 p-3 text-sm">
                  <p className="font-medium text-navy">
                    Попытка {log.attempt_number} — {log.status_display}
                  </p>
                  {log.error_message && (
                    <p className="mt-0.5 text-xs text-red-600">{log.error_message}</p>
                  )}
                  <p className="mt-1 text-xs text-foreground/40">
                    {new Date(log.created_at).toLocaleString("ru-RU")}
                  </p>
                </li>
              ))}
              {lead.uon_sync_logs.length === 0 && (
                <p className="text-xs text-foreground/40">Попыток синхронизации ещё не было</p>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
