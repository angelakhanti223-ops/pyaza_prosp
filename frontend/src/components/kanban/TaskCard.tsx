"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, ExternalLink, Flame, Link2, Repeat } from "lucide-react";
import { uonRecordUrl, type KanbanTask, type TaskKind } from "@/lib/kanbanApi";

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

export default function TaskCard({ task, onClick }: { task: KanbanTask; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const status = deadlineStatus(task.deadline);
  const recordUrl = uonRecordUrl(task);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`cursor-grab rounded-xl border border-black/5 p-3 text-sm shadow-sm active:cursor-grabbing ${KIND_STYLES[task.kind]}`}
    >
      <p className="font-medium text-navy">{task.title}</p>
      {task.lead_name && (
        <p className="mt-1 flex items-center gap-1 text-xs text-blue">
          <Link2 size={12} />
          {task.lead_name}
        </p>
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
