"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { listLeads, listManagers, type CrmUser, type LeadListItem } from "@/lib/crmApi";
import { createTask, deleteTask, updateTask, uonRecordUrl, type KanbanColumn, type KanbanTask } from "@/lib/kanbanApi";

type Props = {
  columns: KanbanColumn[];
  defaultColumnId: number | null;
  task: KanbanTask | null;
  onClose: () => void;
  onSaved: () => void;
};

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TaskModal({ columns, defaultColumnId, task, onClose, onSaved }: Props) {
  const isEdit = Boolean(task);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [columnId, setColumnId] = useState(task?.column ?? defaultColumnId ?? columns[0]?.id ?? 0);
  const [assigneeId, setAssigneeId] = useState<string>(task?.assignee ? String(task.assignee.id) : "");
  const [deadline, setDeadline] = useState(toLocalInputValue(task?.deadline ?? null));
  const [managers, setManagers] = useState<CrmUser[]>([]);
  const [leadQuery, setLeadQuery] = useState(task?.lead_name ?? "");
  const [leadResults, setLeadResults] = useState<LeadListItem[]>([]);
  const [leadId, setLeadId] = useState<number | null>(task?.lead ?? null);
  const [isRecurring, setIsRecurring] = useState(task?.is_recurring ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listManagers().then(setManagers);
  }, []);

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
          assignee_id: assigneeId ? Number(assigneeId) : null,
          lead: leadId,
          deadline: deadlineIso,
          is_recurring: isRecurring,
        });
      } else {
        await createTask({
          title,
          description,
          column: columnId,
          assignee_id: assigneeId ? Number(assigneeId) : null,
          lead: leadId,
          deadline: deadlineIso,
          is_recurring: isRecurring,
        });
      }
      onSaved();
    } catch {
      setError("Не удалось сохранить задачу");
    } finally {
      setSaving(false);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-dark/60 p-4" onClick={onClose}>
      <form
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-4 top-4 text-foreground/40 hover:text-foreground"
        >
          <X size={20} />
        </button>

        <h3 className={`text-lg font-bold text-navy ${task && uonRecordUrl(task) ? "mb-1" : "mb-4"}`}>
          {isEdit ? "Задача" : "Новая задача"}
        </h3>
        {task && uonRecordUrl(task) && (
          <a
            href={uonRecordUrl(task) as string}
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

          {!isEdit && (
            <select
              value={columnId}
              onChange={(e) => setColumnId(Number(e.target.value))}
              className="rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

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

          <label className="flex items-center gap-2 text-sm text-foreground/70">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-black/20"
            />
            Ежедневная задача (при переносе в последнюю колонку создаётся копия на завтра)
          </label>

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
