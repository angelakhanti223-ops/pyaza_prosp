"use client";

import { useEffect, useState } from "react";
import { useCrmAuth } from "@/components/crm/CrmAuthProvider";
import { taskDeadlinePatch, toLocalTaskTime } from "@/lib/taskForm";
import { ExternalLink, Paperclip, X } from "lucide-react";
import { listLeads, listManagers, type CrmUser, type LeadListItem } from "@/lib/crmApi";
import {
  CONTACT_CHANNEL_OPTIONS,
  createTask,
  deleteTask,
  mediaUrl,
  TASK_STATUS_OPTIONS,
  updateTask,
  uonRecordUrl,
  uploadTaskAttachment,
  type ContactChannel,
  type KanbanColumn,
  type KanbanTask,
  type TaskAttachment,
  type TaskStatus,
} from "@/lib/kanbanApi";

type Props = {
  columns: KanbanColumn[];
  defaultColumnId: number | null;
  task: KanbanTask | null;
  onClose: () => void;
  onSaved: () => void;
  // Заполнение задачи с карточки обращения/заявки — только при создании (isEdit
  // проверяется отдельно ниже), сама связь после создания уже не меняется.
  presetLead?: { id: number; name: string } | null;
  presetUonRecord?: { kind: "request" | "lead"; id: string; label: string } | null;
};

export default function TaskModal({
  columns,
  defaultColumnId,
  task,
  onClose,
  onSaved,
  presetLead,
  presetUonRecord,
}: Props) {
  const isEdit = Boolean(task);
  const { user } = useCrmAuth();

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [assigneeId, setAssigneeId] = useState<string>(task?.assignee ? String(task.assignee.id) : task ? "" : String(user?.id ?? ""));
  const [deadline, setDeadline] = useState(toLocalTaskTime(task?.deadline ?? null));
  const [managers, setManagers] = useState<CrmUser[]>([]);
  const [leadQuery, setLeadQuery] = useState(task?.lead_name ?? presetLead?.name ?? "");
  const [leadResults, setLeadResults] = useState<LeadListItem[]>([]);
  const [leadId, setLeadId] = useState<number | null>(task?.lead ?? presetLead?.id ?? null);
  const [isRecurring, setIsRecurring] = useState(task?.is_recurring ?? false);
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? columns.find(column => column.id === defaultColumnId)?.status ?? "new");
  const [contactChannel, setContactChannel] = useState<ContactChannel>(task?.preferred_contact_channel ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attachments, setAttachments] = useState<TaskAttachment[]>(task?.attachments ?? []);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    listManagers().then(setManagers);
  }, []);

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      if (!leadQuery || leadQuery === task?.lead_name) {
        if (active) setLeadResults([]);
        return;
      }
      listLeads({ search: leadQuery }).then((results) => {
        if (active) setLeadResults(results);
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadQuery]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const deadlineIso = deadline ? new Date(deadline).toISOString() : null;
      if (isEdit && task) {
        await updateTask(task.id, {
          title,
          description,
          expected_updated_at: task.updated_at,
          status,
          assignee_id: assigneeId ? Number(assigneeId) : null,
          lead: leadId,
          ...taskDeadlinePatch(task.deadline, deadline),
          is_recurring: isRecurring,
          preferred_contact_channel: contactChannel,
        });
      } else {
        const column = columns.find(column => column.status === status);
        if (!column) throw new Error("Статусы задач ещё не загружены. Обновите страницу.");
        await createTask({
          title,
          description,
          column: column.id,
          status,
          assignee_id: assigneeId ? Number(assigneeId) : null,
          lead: leadId,
          deadline: deadlineIso,
          is_recurring: isRecurring,
          preferred_contact_channel: contactChannel,
          uon_record_kind: presetUonRecord?.kind,
          uon_record_id: presetUonRecord?.id,
        });
      }
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось сохранить задачу");
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!task || !e.target.files?.length) return;
    setUploading(true);
    try {
      const uploaded = await uploadTaskAttachment(task.id, e.target.files[0]);
      setAttachments((prev) => [...prev, uploaded]);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete() {
    if (!task) return;
    setSaving(true);
    try {
      await deleteTask(task.id);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const linkedStatus = task ? (task.lead_status_display ?? task.uon_status_name) : null;
  const recordUrl = task ? uonRecordUrl(task) : null;
  const hasSubheader = Boolean(linkedStatus || recordUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-dark/60 p-4" onClick={event => { event.stopPropagation(); onClose(); }}>
      <form
        role="dialog" aria-modal="true" aria-label={isEdit ? "Редактировать задачу" : "Новая задача"}
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-4 top-4 text-foreground/40 hover:text-foreground"
        >
          <X size={20} />
        </button>

        <h3 className={`text-lg font-bold text-navy ${hasSubheader ? "mb-1" : "mb-4"}`}>
          {isEdit ? "Задача" : "Новая задача"}
        </h3>
        {linkedStatus && (
          <p className={recordUrl ? "mb-1 text-xs text-foreground/50" : "mb-4 text-xs text-foreground/50"}>
            Этап {task?.lead || task?.uon_record_kind === "request" ? "заявки" : "обращения"}:{" "}
            <span className="font-medium text-navy">{linkedStatus}</span>
          </p>
        )}
        {recordUrl && (
          <a
            href={recordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-4 flex items-center gap-1 text-xs font-medium text-blue hover:underline"
          >
            <ExternalLink size={12} />
            Открыть в U-ON
          </a>
        )}

        <div className="flex flex-col gap-3">
          <input
            required
            type="text"
            placeholder="Заголовок"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
          />
          <textarea
            placeholder="Описание"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="resize-none rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
          />

          <label className="text-xs text-foreground/60">Статус задачи
            <select aria-label="Статус задачи" value={status} onChange={event => setStatus(event.target.value as TaskStatus)} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-navy outline-none focus:border-blue">
              {TASK_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <p className="mt-1 text-xs leading-5 text-foreground/45">Этот же статус определяет колонку на доске.</p>
            {status === "postponed" && task?.status !== "postponed" && <p className="mt-1 text-xs text-foreground/55">Если оставить прежний срок, он сдвинется на 3 дня. Можно выбрать другую дату ниже.</p>}
          </label>

          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
          >
            <option value="">Ответственный не назначен</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>

          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
          />

          <select
            value={contactChannel}
            onChange={(e) => setContactChannel(e.target.value as ContactChannel)}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
          >
            <option value="">Приоритетный канал связи не указан</option>
            {CONTACT_CHANNEL_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-foreground/70">
            <input
              type="checkbox"
              disabled={task?.origin === "next_contact"}
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-black/20"
            />
            Ежедневная задача: после выполнения создаётся следующая
          </label>

          {presetLead || task?.origin === "next_contact" ? (
            <p className="rounded-xl border border-black/10 bg-blue-light/20 px-3 py-2 text-sm text-navy">
              Заявка: <strong>{presetLead?.name ?? task?.lead_name}</strong>
            </p>
          ) : presetUonRecord ? (
            <p className="rounded-xl border border-black/10 bg-blue-light/20 px-3 py-2 text-sm text-navy">
              Привязана к {presetUonRecord.kind === "request" ? "заявке" : "обращению"} U-ON:{" "}
              <strong>{presetUonRecord.label}</strong>
            </p>
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder="Привязать заявку (поиск по имени/телефону)"
                value={leadQuery}
                onChange={(e) => {
                  setLeadQuery(e.target.value);
                  setLeadId(null);
                }}
                className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
              />
              {leadResults.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-xl border border-black/10 bg-white shadow-lg">
                  {leadResults.map((lead) => (
                    <li key={lead.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setLeadId(lead.id);
                          setLeadQuery(lead.name);
                          setLeadResults([]);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-light"
                      >
                        {lead.name} · {lead.phone}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {isEdit && task && (
            <div>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-black/15 px-3 py-2.5 text-sm text-foreground/60 hover:border-blue hover:text-blue">
                <Paperclip size={15} />
                {uploading ? "Загрузка…" : "Прикрепить файл"}
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
              <ul className="mt-2 flex flex-col gap-1">
                {attachments.map((a) => (
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
                {attachments.length === 0 && (
                  <p className="text-xs text-foreground/40">Файлов пока нет</p>
                )}
              </ul>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex items-center justify-between">
          {isEdit ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="text-sm font-medium text-red-600 hover:underline"
            >
              Удалить
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue disabled:opacity-60"
          >
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}
