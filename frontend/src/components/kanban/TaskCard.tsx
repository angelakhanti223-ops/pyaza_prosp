"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Link2 } from "lucide-react";
import type { KanbanTask } from "@/lib/kanbanApi";

function deadlineStatus(deadline: string | null): "overdue" | "soon" | "normal" | null {
  if (!deadline) return null;
  const diffMs = new Date(deadline).getTime() - Date.now();
  if (diffMs < 0) return "overdue";
  if (diffMs < 24 * 60 * 60 * 1000) return "soon";
  return "normal";
}

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="cursor-grab rounded-xl border border-black/5 bg-white p-3 text-sm shadow-sm active:cursor-grabbing"
    >
      <p className="font-medium text-navy">{task.title}</p>
      {task.lead_name && (
        <p className="mt-1 flex items-center gap-1 text-xs text-blue">
          <Link2 size={12} />
          {task.lead_name}
        </p>
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
