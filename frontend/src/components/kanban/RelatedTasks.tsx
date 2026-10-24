"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listColumns, listTasks, updateTask, type KanbanColumn, type KanbanTask, type TaskFilters, type TaskStatus } from "@/lib/kanbanApi";
import { listenForTaskChanges } from "@/lib/taskEvents";
import TaskList from "./TaskList";
import TaskModal from "./TaskModal";

export default function RelatedTasks({ filters, presetLead, presetUonRecord, onChanged }: {
  filters: TaskFilters;
  presetLead?: { id: number; name: string };
  presetUonRecord?: { kind: "request" | "lead"; id: string; label: string };
  onChanged?: () => void;
}) {
  const filterKey = JSON.stringify(filters);
  const request = useRef(0);
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [modal, setModal] = useState<{ task: KanbanTask | null } | null>(null);

  const load = useCallback(async () => {
    const id = ++request.current;
    try {
      const [rows, cols] = await Promise.all([listTasks(JSON.parse(filterKey) as TaskFilters), listColumns()]);
      if (id === request.current) { setTasks(rows); setColumns(cols); setError(""); }
    } catch (error) { if (id === request.current) setError(error instanceof Error ? error.message : "Не удалось загрузить задачи."); }
    finally { if (id === request.current) setLoading(false); }
  }, [filterKey]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) void load(); });
    const stop = listenForTaskChanges(() => { void load(); onChanged?.(); });
    return () => { active = false; stop(); request.current += 1; };
  }, [load, onChanged]);

  async function changeStatus(task: KanbanTask, status: TaskStatus) {
    setBusyId(task.id); setError("");
    try { await updateTask(task.id, { status, expected_updated_at: task.updated_at }); }
    catch (error) { await load(); setError(error instanceof Error ? error.message : "Не удалось изменить задачу."); }
    finally { setBusyId(null); }
  }

  const open = tasks.filter(task => task.status !== "done" && task.status !== "cancelled");
  const closed = tasks.filter(task => task.status === "done" || task.status === "cancelled");
  return <section className="mt-6 min-w-0 rounded-2xl border border-black/5 bg-white p-4 sm:p-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold text-navy">Задачи по {presetUonRecord?.kind === "lead" ? "обращению" : "заявке"} · {open.length} в работе</h2><button type="button" onClick={() => setModal({ task: null })} disabled={!columns.length} className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">+ Создать задачу</button></div>
    {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}<button type="button" onClick={() => void load()} className="ml-2 underline">Обновить</button></p>}
    {loading ? <p className="text-xs text-foreground/50">Загружаем задачи…</p> : <TaskList tasks={open} onEdit={task => setModal({ task })} onStatus={changeStatus} busyId={busyId} />}
    {closed.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-xs font-medium text-foreground/60">Выполненные и отменённые · {closed.length}</summary><div className="mt-3"><TaskList tasks={closed} onEdit={task => setModal({ task })} onStatus={changeStatus} busyId={busyId} /></div></details>}
    {modal && <TaskModal task={modal.task} columns={columns} defaultColumnId={columns.find(column => column.status === "new")?.id ?? null} presetLead={modal.task ? null : presetLead} presetUonRecord={presetUonRecord} onClose={() => setModal(null)} onSaved={() => setModal(null)} />}
  </section>;
}
