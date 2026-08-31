"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { useCrmAuth } from "@/components/crm/CrmAuthProvider";
import { listManagers, type CrmUser } from "@/lib/crmApi";
import { listColumns, listTasks, moveTask, type KanbanColumn, type KanbanTask } from "@/lib/kanbanApi";
import BoardToolbar, { type AssigneeFilter, type DateFilter, type SortMode } from "./BoardToolbar";
import Column from "./Column";
import TaskCard from "./TaskCard";
import TaskModal from "./TaskModal";

const PRIORITY_RANK: Record<string, number> = { urgent_important: 0, important: 1 };

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function matchesDateFilter(task: KanbanTask, filter: DateFilter): boolean {
  if (filter === "all") return true;
  if (!task.deadline) return false;

  const today = startOfDay(new Date());
  const deadlineDay = startOfDay(new Date(task.deadline));

  if (filter === "overdue") return deadlineDay.getTime() < today.getTime();
  if (filter === "today") return deadlineDay.getTime() === today.getTime();
  // week — сегодня и ещё 6 дней вперёд (просроченные сюда не попадают, для них своя кнопка)
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return deadlineDay.getTime() >= today.getTime() && deadlineDay.getTime() <= weekEnd.getTime();
}

function sortTasks(tasks: KanbanTask[], mode: SortMode): KanbanTask[] {
  if (mode === "manual") return [...tasks].sort((a, b) => a.order - b.order);
  if (mode === "priority") {
    return [...tasks].sort((a, b) => (PRIORITY_RANK[a.priority ?? ""] ?? 2) - (PRIORITY_RANK[b.priority ?? ""] ?? 2));
  }
  // deadline — задачи без срока уходят в конец
  return [...tasks].sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });
}

function resolveTargetColumnId(overId: string | number, tasks: KanbanTask[]): number | null {
  if (typeof overId === "string" && overId.startsWith("column-")) {
    return Number(overId.replace("column-", ""));
  }
  const overTask = tasks.find((t) => t.id === overId);
  return overTask ? overTask.column : null;
}

export default function Board() {
  const { user } = useCrmAuth();
  const searchParams = useSearchParams();
  const taskParam = searchParams.get("task");
  const openedFromQuery = useRef(false);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [managers, setManagers] = useState<CrmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [modalState, setModalState] = useState<{ task: KanbanTask | null; columnId: number | null } | null>(null);
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("manual");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = () => {
    Promise.all([listColumns(), listTasks(), listManagers()]).then(([cols, tks, mgrs]) => {
      setColumns(cols);
      setTasks(tks);
      setManagers(mgrs);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (openedFromQuery.current || !taskParam || tasks.length === 0) return;
    const match = tasks.find((t) => t.id === Number(taskParam));
    if (match) {
      openedFromQuery.current = true;
      // Открытие модалки задачи по ссылке из карточки заявки (?task=id) — это
      // единоразовая синхронизация с URL при монтировании (охраняется ref'ом
      // выше), а не циклический побочный эффект, которого опасается это правило.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModalState({ task: match, columnId: null });
    }
  }, [tasks, taskParam]);

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

  const filtersActive =
    search.trim() !== "" || assigneeFilter !== "all" || dateFilter !== "all" || sortMode !== "manual";

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (query) {
        const haystack = `${task.title} ${task.description} ${task.lead_name ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (assigneeFilter === "mine" && task.assignee?.id !== user?.id) return false;
      if (assigneeFilter === "unassigned" && task.assignee) return false;
      if (typeof assigneeFilter === "number" && task.assignee?.id !== assigneeFilter) return false;
      if (!matchesDateFilter(task, dateFilter)) return false;
      return true;
    });
  }, [tasks, search, assigneeFilter, dateFilter, user]);

  const visibleTasksByColumn = useMemo(() => {
    const grouped: Record<number, KanbanTask[]> = {};
    for (const col of columns) grouped[col.id] = [];
    for (const task of visibleTasks) {
      if (!grouped[task.column]) grouped[task.column] = [];
      grouped[task.column].push(task);
    }
    for (const colId in grouped) {
      grouped[colId] = sortTasks(grouped[colId], sortMode);
    }
    return grouped;
  }, [columns, visibleTasks, sortMode]);

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
      <BoardToolbar
        search={search}
        onSearchChange={setSearch}
        assigneeFilter={assigneeFilter}
        onAssigneeFilterChange={setAssigneeFilter}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        managers={managers}
        resultCount={visibleTasks.length}
      />
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
              tasks={visibleTasksByColumn[col.id] ?? []}
              draggable={!filtersActive}
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
