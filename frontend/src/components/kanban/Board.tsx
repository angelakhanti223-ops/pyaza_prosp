"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { listenForTaskChanges } from "@/lib/taskEvents";
import { previewTaskMove, dropIndex, matchesTaskDate, taskGroupMatches, sortClosedTasks } from "@/lib/boardState";
import TaskList from "./TaskList";
import { useTaskClock } from "@/lib/useTaskClock";
import { useCrmAuth } from "@/components/crm/CrmAuthProvider";
import { listManagers, type CrmUser } from "@/lib/crmApi";
import { listColumns, listTasks, moveTask, updateTask, type KanbanColumn, type KanbanTask, type TaskStatus } from "@/lib/kanbanApi";
import BoardToolbar, { type AssigneeFilter, type DateFilter, type SortMode } from "./BoardToolbar";
import Column from "./Column";
import TaskCard from "./TaskCard";
import TaskModal from "./TaskModal";

const PRIORITY_RANK: Record<string, number> = { urgent_important: 0, important: 1 };

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
  const now = useTaskClock();
  const { user } = useCrmAuth();
  const searchParams = useSearchParams();
  const taskParam = searchParams.get("task");
  const openedFromQuery = useRef("");
  const dragSnapshot = useRef<KanbanTask[] | null>(null);
  const requestId = useRef(0);
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
  const [view, setView] = useState<"board" | "list">("board");
  const [showClosed, setShowClosed] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    if (dragSnapshot.current) return;
    const id = ++requestId.current;
    try {
      const [cols, rows, people] = await Promise.all([listColumns(), listTasks(), listManagers()]);
      if (id === requestId.current && !dragSnapshot.current) { setColumns(cols); setTasks(rows); setManagers(people); }
    } catch (error) { if (id === requestId.current) setError(error instanceof Error ? error.message : "Не удалось загрузить задачи."); }
    finally { if (id === requestId.current) setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) void load(); });
    const stop = listenForTaskChanges(() => { void load(); });
    return () => { active = false; stop(); requestId.current += 1; };
  }, [load]);

  useEffect(() => {
    if (openedFromQuery.current === taskParam || !taskParam || tasks.length === 0) return;
    const match = tasks.find((t) => t.id === Number(taskParam));
    if (match) {
      openedFromQuery.current = taskParam;
      // Открытие модалки задачи по ссылке из карточки заявки (?task=id) — это
      // единоразовая синхронизация с URL при монтировании (охраняется ref'ом
      // выше), а не циклический побочный эффект, которого опасается это правило.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModalState({ task: match, columnId: null });
    }
  }, [tasks, taskParam]);

  const matchingTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (query) {
        const haystack = `${task.title} ${task.description} ${task.lead_name ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (assigneeFilter === "mine" && task.assignee?.id !== user?.id) return false;
      if (assigneeFilter === "unassigned" && task.assignee) return false;
      if (typeof assigneeFilter === "number" && task.assignee?.id !== assigneeFilter) return false;
      return true;
    });
  }, [tasks, search, assigneeFilter, user]);

  const closedCount = matchingTasks.filter(task => taskGroupMatches(task, true)).length;
  const workingColumns = columns.filter(column => column.status !== "done" && column.status !== "cancelled");
  const visibleTasks = useMemo(() => matchingTasks.filter(task => taskGroupMatches(task, showClosed) && (showClosed || matchesTaskDate(task, dateFilter, new Date(now)))), [matchingTasks, showClosed, dateFilter, now]);

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
    dragSnapshot.current = tasks;
    setError(""); setMessage("");
    setActiveTask(tasks.find(task => task.id === event.active.id) ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    if (!event.over || !dragSnapshot.current) return;
    const targetId = resolveTargetColumnId(event.over.id, tasks);
    const column = columns.find(column => column.id === targetId);
    if (column) setTasks(previewTaskMove(dragSnapshot.current, Number(event.active.id), column));
  }

  function cancelDrag() {
    if (dragSnapshot.current) setTasks(dragSnapshot.current);
    dragSnapshot.current = null;
    setActiveTask(null);
    void load();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const snapshot = dragSnapshot.current;
    const task = snapshot?.find(task => task.id === event.active.id);
    if (!snapshot || !task || !event.over) { cancelDrag(); return; }
    const columnId = resolveTargetColumnId(event.over.id, tasks) ?? task.column;
    if (columnId === task.column && (sortMode !== "manual" || event.over.id === task.id)) { cancelDrag(); return; }
    const order = dropIndex(snapshot, task.id, columnId, event.over.id);
    dragSnapshot.current = null;
    setActiveTask(null); setBusyId(task.id);
    try {
      const saved = await moveTask(task.id, columnId, order, task.updated_at);
      setTasks(current => current.map(item => item.id === saved.id ? saved : item));
      if (saved.status === "postponed" && task.status !== "postponed" && saved.deadline) setMessage(`Задача отложена до ${new Date(saved.deadline).toLocaleString("ru-RU")}.`);
      await load();
    } catch (error) {
      setTasks(snapshot);
      setError(error instanceof Error ? error.message : "Не удалось переместить задачу.");
      await load();
    } finally { setBusyId(null); }
  }

  async function changeStatus(task: KanbanTask, status: TaskStatus) {
    setBusyId(task.id); setError("");
    try { await updateTask(task.id, { status, expected_updated_at: task.updated_at }); await load(); }
    catch (error) { setError(error instanceof Error ? error.message : "Не удалось изменить статус."); await load(); }
    finally { setBusyId(null); }
  }

  if (loading) return <p className="text-sm text-foreground/50">Загрузка доски…</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div role="group" aria-label="Вид задач" className="flex gap-2"><button type="button" aria-pressed={view === "board" && !showClosed} onClick={() => { setView("board"); setShowClosed(false); }} className={`rounded-full px-4 py-2 text-sm font-semibold ${view === "board" && !showClosed ? "bg-navy text-white" : "bg-white text-navy"}`}>Канбан</button><button type="button" aria-pressed={view === "list" && !showClosed} onClick={() => { setView("list"); setShowClosed(false); }} className={`rounded-full px-4 py-2 text-sm font-semibold ${view === "list" && !showClosed ? "bg-navy text-white" : "bg-white text-navy"}`}>Список</button></div><div className="ml-auto flex flex-wrap items-center gap-2"><button type="button" aria-pressed={showClosed} onClick={() => setShowClosed(value => !value)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${showClosed ? "border-navy bg-navy text-white" : "border-navy/15 bg-white text-navy"}`}>{showClosed ? "Скрыть закрытые задачи" : "Показать закрытые задачи"} · {closedCount}</button><button type="button" onClick={() => setModalState({ task: null, columnId: columns.find(column => column.status === "new")?.id ?? null })} disabled={!columns.length} className="rounded-full bg-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">+ Задача</button></div></div>
      <p className="mb-4 text-xs leading-5 text-foreground/55">Колонка — это статус задачи. Его можно менять перетаскиванием или в карточке. Фильтры дней работают по московскому времени.</p>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}<button type="button" onClick={() => void load()} className="ml-3 underline">Обновить</button></p>}
      {message && <p role="status" className="mb-4 rounded-xl bg-blue-light p-3 text-xs text-navy">{message}</p>}
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
        closedView={showClosed}
      />
      {showClosed ? <section aria-label="Закрыто"><h2 className="mb-3 text-lg font-semibold text-navy">Закрыто · {visibleTasks.length}</h2><p className="mb-4 text-xs text-foreground/55">Выполненные и отменённые задачи. Последние закрытые — сверху. Задачу можно открыть или возобновить.</p><TaskList tasks={sortClosedTasks(visibleTasks)} onEdit={task => setModalState({ task, columnId: null })} onStatus={changeStatus} busyId={busyId} /></section> : view === "list" ? <TaskList tasks={sortTasks(visibleTasks, sortMode === "manual" ? "deadline" : sortMode)} onEdit={task => setModalState({ task, columnId: null })} onStatus={changeStatus} busyId={busyId} /> : <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={cancelDrag}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {workingColumns.map((col) => (
            <Column
              key={col.id}
              column={col}
              tasks={visibleTasksByColumn[col.id] ?? []}
              draggable={busyId === null}
              onTaskClick={(task) => setModalState({ task, columnId: null })}
              onAddTask={(columnId) => setModalState({ task: null, columnId })}
              onComplete={(task) => void changeStatus(task, "done")}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} onClick={() => {}} /> : null}
        </DragOverlay>
      </DndContext>}

      {modalState && (
        <TaskModal
          columns={columns}
          defaultColumnId={modalState.columnId}
          task={modalState.task}
          onClose={() => setModalState(null)}
          onSaved={() => {
            if (!modalState.task) setShowClosed(false);
            setModalState(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
