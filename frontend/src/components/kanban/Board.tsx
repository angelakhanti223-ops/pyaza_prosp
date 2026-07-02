"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { listColumns, listTasks, moveTask, type KanbanColumn, type KanbanTask } from "@/lib/kanbanApi";
import Column from "./Column";
import TaskCard from "./TaskCard";
import TaskModal from "./TaskModal";

function resolveTargetColumnId(overId: string | number, tasks: KanbanTask[]): number | null {
  if (typeof overId === "string" && overId.startsWith("column-")) {
    return Number(overId.replace("column-", ""));
  }
  const overTask = tasks.find((t) => t.id === overId);
  return overTask ? overTask.column : null;
}

export default function Board() {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [modalState, setModalState] = useState<{ task: KanbanTask | null; columnId: number | null } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = () => {
    Promise.all([listColumns(), listTasks()]).then(([cols, tks]) => {
      setColumns(cols);
      setTasks(tks);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const tasksByColumn = useMemo(() => {
    const grouped: Record<number, KanbanTask[]> = {};
    for (const col of columns) grouped[col.id] = [];
    for (const task of tasks) {
      if (!grouped[task.column]) grouped[task.column] = [];
      grouped[task.column].push(task);
    }
    for (const colId in grouped) {
      grouped[colId].sort((a, b) => a.order - b.order);
    }
    return grouped;
  }, [columns, tasks]);

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeTaskItem = tasks.find((t) => t.id === active.id);
    if (!activeTaskItem) return;

    const targetColumnId = resolveTargetColumnId(over.id, tasks);
    if (targetColumnId === null || targetColumnId === activeTaskItem.column) return;

    setTasks((prev) => prev.map((t) => (t.id === active.id ? { ...t, column: targetColumnId } : t)));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const activeTaskItem = tasks.find((t) => t.id === active.id);
    if (!activeTaskItem) return;

    const targetColumnId = resolveTargetColumnId(over.id, tasks) ?? activeTaskItem.column;
    const columnTasks = tasksByColumn[targetColumnId] ?? [];
    const overIndex = columnTasks.findIndex((t) => t.id === over.id);
    const newIndex = overIndex >= 0 ? overIndex : columnTasks.length;

    setTasks((prev) => {
      const withoutActive = prev.filter((t) => t.id !== active.id);
      const reorderedColumnTasks = arrayMove(
        [...columnTasks.filter((t) => t.id !== active.id), activeTaskItem],
        columnTasks.filter((t) => t.id !== active.id).length,
        newIndex
      );
      const otherTasks = withoutActive.filter((t) => t.column !== targetColumnId);
      return [...otherTasks, ...reorderedColumnTasks];
    });

    moveTask(Number(active.id), targetColumnId, newIndex).catch(() => load());
  }

  if (loading) return <p className="text-sm text-foreground/50">Загрузка доски…</p>;

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <Column
              key={col.id}
              column={col}
              tasks={tasksByColumn[col.id] ?? []}
              onTaskClick={(task) => setModalState({ task, columnId: null })}
              onAddTask={(columnId) => setModalState({ task: null, columnId })}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} onClick={() => {}} /> : null}
        </DragOverlay>
      </DndContext>

      {modalState && (
        <TaskModal
          columns={columns}
          defaultColumnId={modalState.columnId}
          task={modalState.task}
          onClose={() => setModalState(null)}
          onSaved={() => {
            setModalState(null);
            load();
          }}
        />
      )}
    </div>
  );
}
