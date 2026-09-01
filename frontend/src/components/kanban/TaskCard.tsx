"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, ExternalLink, Flame, Link2, Repeat } from "lucide-react";
import { uonRecordUrl, type KanbanTask, type TaskKind, type TaskStatus } from "@/lib/kanbanApi";

// "new" не показываем — это статус по умолчанию, бейдж по нему был бы шумом на
// каждой карточке доски.
const TASK_STATUS_STYLES: Partial<Record<TaskStatus, string>> = {
  in_progress: "bg-blue-100 text-blue-700",
  postponed: "bg-amber-100 text-amber-700",
  done: "bg-green-100 text-green-700",
  cancelled: "bg-black/10 text-foreground/50",
};

function deadlineStatus(deadline: string | null): "overdue" | "soon" | "normal" | null {
  if (!deadline) return null;
  const diffMs = new Date(deadline).getTime() - Date.now();
  if (diffMs < 0) return "overdue";
  if (diffMs < 24 * 60 * 60 * 1000) return "soon";
  return "normal";
}

const KIND_STYLES: Record<TaskKind, string> = {
  lead: "border-l-4 border-l-sky-400 bg-sky-50",
  appeal: "border-l-4 border-l-indigo-400 bg-indigo-50",
  general: "border-l-4 border-l-yellow-400 bg-yellow-50",
};

export default function TaskCard({
  task,
  draggable = true,
  onClick,
}: {
  task: KanbanTask;
  draggable?: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !draggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const status = deadlineStatus(task.deadline);
  const recordUrl = uonRecordUrl(task);
  // Статус связанного обращения/заявки — своей CRM (lead_status_display) или
  // из U-ON-зеркала (uon_status_name), смотря что привязано к задаче.
  const linkedStatus = task.lead_status_display ?? task.uon_status_name;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(draggable ? listeners : {})}
      onClick={onClick}
      className={`rounded-xl border border-black/5 p-3 text-sm shadow-sm ${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${KIND_STYLES[task.kind]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`font-medium text-navy ${task.status === "done" || task.status === "cancelled" ? "line-through opacity-60" : ""}`}>
          {task.title}
        </p>
        {TASK_STATUS_STYLES[task.status] && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TASK_STATUS_STYLES[task.status]}`}
          >
            {task.status_display}
          </span>
        )}
      </div>
      {task.lead_name && (
        <p className="mt-1 flex items-center gap-1 text-xs text-blue">
          <Link2 size={12} />
          {task.lead_name}
        </p>
      )}
      {linkedStatus && (
        <span className="mt-1 inline-block rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-medium text-navy">
          {linkedStatus}
        </span>
      )}
      {recordUrl && (
        <a
          href={recordUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-1 flex items-center gap-1 text-xs text-blue hover:underline"
        >
          <ExternalLink size={12} />
          Открыть в U-ON
        </a>
      )}
      {task.priority === "urgent_important" && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
          <Flame size={10} />
          Срочно · Важно
        </span>
      )}
      {task.priority === "important" && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
          <Repeat size={10} />
          Важно · не срочно
        </span>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-foreground/50">{task.assignee?.full_name ?? "Не назначен"}</span>
        {task.deadline && (
          <span
            className={`flex items-center gap-1 text-xs ${
              status === "overdue" ? "text-red-600" : status === "soon" ? "text-amber-600" : "text-foreground/40"
            }`}
          >
            {status !== "normal" && <AlertTriangle size={12} />}
            {new Date(task.deadline).toLocaleDateString("ru-RU")}
          </span>
        )}
      </div>
    </div>
  );
}
