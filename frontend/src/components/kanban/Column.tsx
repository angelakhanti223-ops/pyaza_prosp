"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import type { KanbanColumn, KanbanTask } from "@/lib/kanbanApi";
import TaskCard from "./TaskCard";

type Props = {
  column: KanbanColumn;
  tasks: KanbanTask[];
  onTaskClick: (task: KanbanTask) => void;
  onAddTask: (columnId: number) => void;
};

export default function Column({ column, tasks, onTaskClick, onAddTask }: Props) {
  const { setNodeRef } = useDroppable({ id: `column-${column.id}` });

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-2xl bg-blue-light/40 p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-sm font-semibold text-navy">
          {column.name} <span className="text-xs font-normal text-foreground/40">{tasks.length}</span>
        </p>
        <button
          onClick={() => onAddTask(column.id)}
          aria-label="Добавить задачу"
          className="flex h-6 w-6 items-center justify-center rounded-full text-navy/50 hover:bg-white hover:text-navy"
        >
          <Plus size={16} />
        </button>
      </div>

      <div ref={setNodeRef} className="flex min-h-[60px] flex-col gap-2">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
