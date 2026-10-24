"use client";

import Link from "next/link";
import { Check, RotateCcw } from "lucide-react";
import { isTaskClosed, TASK_STATUS_OPTIONS, type KanbanTask, type TaskStatus } from "@/lib/kanbanApi";
import { useTaskClock } from "@/lib/useTaskClock";

export function taskContext(task: KanbanTask) {
  if (task.lead) return { href: `/crm/leads/${task.lead}`, label: `Заявка: ${task.lead_name || `№${task.lead}`}` };
  if (task.uon_record_kind && task.uon_record_id) return {
    href: `/crm/${task.uon_record_kind === "lead" ? "appeals" : "uon-requests"}?uon_id=${encodeURIComponent(task.uon_record_id)}`,
    label: `${task.uon_record_kind === "lead" ? "Обращение" : "Заявка"} U-ON №${task.uon_record_id}`,
  };
  return null;
}

export default function TaskList({ tasks, onEdit, onStatus, busyId }: {
  tasks: KanbanTask[];
  onEdit: (task: KanbanTask) => void;
  onStatus: (task: KanbanTask, status: TaskStatus) => void;
  busyId: number | null;
}) {
  const now = useTaskClock();
  if (!tasks.length) return <p className="rounded-2xl bg-blue-light/40 p-5 text-sm text-foreground/55">Задач по выбранным условиям пока нет.</p>;
  return <ul className="space-y-3">{tasks.map(task => {
    const closed = isTaskClosed(task);
    const overdue = !closed && task.deadline && new Date(task.deadline).getTime() < now;
    const context = taskContext(task);
    return <li key={task.id} className="flex min-w-0 flex-wrap items-start gap-3 rounded-2xl border border-black/10 bg-white p-4">
      <button type="button" disabled={busyId !== null} onClick={() => onStatus(task, closed ? "new" : "done")} aria-label={`${closed ? "Возобновить" : "Выполнить"}: ${task.title}`} className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border disabled:opacity-40 ${closed ? "border-green-200 bg-green-50 text-green-700" : "border-navy/20 text-navy hover:bg-blue-light"}`}>{closed ? <RotateCcw size={15} /> : <Check size={16} />}</button>
      <div className="min-w-0 flex-1 basis-40">
        <button type="button" onClick={() => onEdit(task)} className={`break-words text-left text-sm font-semibold text-navy hover:underline ${closed ? "opacity-60" : ""}`}>{task.title}</button>
        {context && <Link href={context.href} className="mt-1 block break-words text-xs text-blue hover:underline">{context.label}</Link>}
        <p className="mt-1 text-xs text-foreground/55">{task.assignee?.full_name || "Ответственный не назначен"}</p>
        <p className={`mt-1 text-xs ${overdue ? "font-medium text-red-600" : "text-foreground/50"}`}>{task.deadline ? `${overdue ? "Просрочено · " : ""}${new Date(task.deadline).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "Без срока"}</p>
      </div>
      <select aria-label={`Статус задачи ${task.title}`} value={task.status} onChange={event => onStatus(task, event.target.value as TaskStatus)} disabled={busyId !== null} className="min-h-10 max-w-full rounded-xl border border-navy/15 bg-white px-3 text-xs text-navy disabled:opacity-50">{TASK_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
    </li>;
  })}</ul>;
}
