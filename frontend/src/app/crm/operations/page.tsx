"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Clock3, FileCheck2, PlaneLanding, PlaneTakeoff, Plus, RefreshCw } from "lucide-react";
import { useCrmAuth } from "@/components/crm/CrmAuthProvider";
import TaskModal from "@/components/kanban/TaskModal";
import TaskList from "@/components/kanban/TaskList";
import { listColumns, updateTask, type KanbanColumn, type KanbanTask, type TaskStatus } from "@/lib/kanbanApi";
import { listenForTaskChanges } from "@/lib/taskEvents";
import { getOperationsDashboard, operationTasks, type OperationsDashboard, type TaskBucket, type TravelTrip } from "@/lib/operationsApi";
import styles from "./operations.module.css";

type Filter = TaskBucket | "urgent" | "documents";
type Modal = { task: KanbanTask | null; trip?: TravelTrip };
const FILTERS: { value: Filter; label: string }[] = [
  { value: "urgent", label: "Требуют внимания" }, { value: "overdue", label: "Просрочены" },
  { value: "today", label: "Сегодня" }, { value: "period", label: "В периоде" },
  { value: "documents", label: "Документы" }, { value: "no_deadline", label: "Без срока" },
  { value: "all", label: "Все открытые" },
];
const date = (value: string | null) => value ? new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Moscow" }).format(new Date(`${value}T12:00:00+03:00`)) : "Не указана";

export default function OperationsPage() {
  const { user } = useCrmAuth();
  const [days, setDays] = useState(7);
  const [start, setStart] = useState("");
  const [assignee, setAssignee] = useState("");
  const [filter, setFilter] = useState<Filter>("urgent");
  const [data, setData] = useState<OperationsDashboard | null>(null);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);
  const [notice, setNotice] = useState("");
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const id = ++sequence.current;
    setRefreshing(true);
    try {
      const [result, cols] = await Promise.all([getOperationsDashboard({ days, start, assignee }), listColumns()]);
      if (sequence.current === id) { setData(result); setColumns(cols); setError(""); }
    } catch (e) { if (sequence.current === id) setError(e instanceof Error ? e.message : "Не удалось загрузить дашборд."); }
    finally { if (sequence.current === id) setRefreshing(false); }
  }, [days, start, assignee]);
  useEffect(() => {
    void load();
    const stop = listenForTaskChanges(() => void load());
    return () => { stop(); sequence.current += 1; };
  }, [load]);

  async function status(task: KanbanTask, next: TaskStatus) {
    setBusy(task.id); setNotice("");
    try {
      await updateTask(task.id, { status: next, expected_updated_at: task.updated_at });
      setNotice(next === "done" ? "Задача выполнена и перенесена в закрытые." : "Статус задачи обновлен.");
      await load();
    } catch (e) { await load(); setError(e instanceof Error ? e.message : "Не удалось изменить задачу."); }
    finally { setBusy(null); }
  }

  const tasks = data ? operationTasks(data, filter) : [];
  function tripList(rows: TravelTrip[], kind: "departure" | "return") {
    if (!rows.length) return <div className={styles.empty}><CheckCircle2 size={26} /><p>В выбранном периоде {kind === "departure" ? "вылетов" : "возвращений"} нет.</p></div>;
    return <ul className={styles.trips}>{rows.map(trip => {
      const day = kind === "departure" ? trip.departure_date : trip.return_date;
      const related = data!.tasks.filter(task => trip.task_ids.includes(task.id));
      return <li key={trip.key} className={styles.trip}>
        <div className={styles.tripHead}><span className={`${styles.date} ${kind === "return" ? styles.returnDate : ""}`}>{date(day)}{day === data!.today && <b>Сегодня</b>}</span><span className={styles.status}>{trip.status}</span></div>
        <Link href={trip.href} className={styles.client}>{trip.name}</Link>
        <p className={styles.route}>{trip.direction || "Направление не указано"}{trip.departure_city && ` · из ${trip.departure_city}`}</p>
        {kind === "return" && trip.return_source !== "crm" && <p className={styles.estimate}>{trip.return_source === "uon_tour_end" ? "Окончание тура по U-ON; дату прилета уточнить" : "Ориентировочно: дата вылета + число ночей"}</p>}
        <p className={styles.meta}>{trip.manager_name}{trip.phone && <> · <a href={`tel:${trip.phone}`}>{trip.phone}</a></>}</p>
        {related.length ? <ul className={styles.related}>{related.map(task => <li key={task.id}><button type="button" onClick={() => setModal({ task })}>{task.title}</button><span>{task.assignee?.full_name || "Без исполнителя"}</span></li>)}</ul> : <p className={styles.noTasks}>Нет открытых задач в выбранном фильтре.</p>}
        <button type="button" className={styles.addTask} disabled={!columns.length} onClick={() => setModal({ task: null, trip })}><Plus size={15} />Задача по поездке</button>
      </li>;
    })}</ul>;
  }

  return <div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>СОПРОВОЖДЕНИЕ ТУРИСТОВ</p><h1>Вылеты, прилеты и задачи</h1><p className={styles.subtitle}>Один рабочий экран для поездок и задач команды. Даты и сроки — по Москве.</p></div><div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => void load()} disabled={refreshing}><RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />Обновить</button><button type="button" className={styles.primary} disabled={!columns.length} onClick={() => setModal({ task: null })}><Plus size={17} />Создать задачу</button></div></header>
    <div className={styles.toolbar}><div className={styles.periodButtons}>{[1, 7, 30].map(n => <button key={n} type="button" aria-pressed={days === n} className={days === n ? styles.selected : ""} onClick={() => { setDays(n); if (n === 1) setStart(""); }}>{n === 1 ? "Сегодня" : `${n} дней`}</button>)}</div><label>Начало периода<input type="date" value={start || data?.today || ""} onChange={e => setStart(e.target.value)} /></label><label>Ответственный<select value={assignee} onChange={e => setAssignee(e.target.value)}><option value="">Вся команда</option>{data?.managers.map(manager => <option key={manager.id} value={manager.id}>{manager.full_name}</option>)}</select></label><button type="button" className={styles.mine} aria-pressed={assignee === String(user?.id)} onClick={() => setAssignee(assignee === String(user?.id) ? "" : String(user?.id ?? ""))}>Мои</button></div>
    {error && <div role="alert" className={styles.error}>{error} {data && "Показаны последние загруженные данные."}<button type="button" onClick={() => void load()}>Повторить</button></div>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {!data ? <p role="status" className={styles.loading}>{refreshing ? "Загружаем поездки и задачи…" : "Данные пока не загружены."}</p> : <>
      <div className={styles.asof}><span><CalendarDays size={15} />{date(data.period.start)} — {date(data.period.end)}</span><span>{refreshing ? "Обновляем…" : `Обновлено ${new Date(data.generated_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" })} МСК · автообновление 30 сек.`}</span></div>
      <div className={styles.metrics}>
        <div className={`${styles.metric} ${styles.blue}`}><PlaneTakeoff /><span>Вылеты в периоде</span><strong>{data.counts.departures}</strong></div>
        <div className={`${styles.metric} ${styles.green}`}><PlaneLanding /><span>Возвращения в периоде</span><strong>{data.counts.returns}</strong></div>
        <button type="button" className={`${styles.metric} ${styles.rose}`} onClick={() => setFilter("overdue")}><AlertTriangle /><span>Просроченные задачи</span><strong>{data.counts.overdue}</strong></button>
        <button type="button" className={`${styles.metric} ${styles.lilac}`} onClick={() => setFilter("today")}><Clock3 /><span>Задачи на сегодня</span><strong>{data.counts.today}</strong></button>
        <button type="button" className={`${styles.metric} ${styles.sand}`} onClick={() => setFilter("documents")}><FileCheck2 /><span>Документы к выдаче</span><strong>{data.counts.documents}</strong></button>
      </div>
      <div className={styles.agenda}><section className={styles.panel}><div className={styles.panelTitle}><PlaneTakeoff /><h2>Ближайшие вылеты</h2><span>{data.departures.length}</span></div><p className={styles.panelNote}>Проверить документы и детали перед поездкой.</p>{tripList(data.departures, "departure")}</section><section className={styles.panel}><div className={styles.panelTitle}><PlaneLanding /><h2>Прилеты и возвращения</h2><span>{data.returns.length}</span></div><p className={styles.panelNote}>Подтвержденный прилет из CRM или пометка об источнике даты.</p>{tripList(data.returns, "return")}</section></div>
      <section className={styles.panel}><div className={styles.panelTitle}><ClipboardList /><h2>Задачи CRM</h2><span>{data.tasks.length} открытых</span><Link href="/crm/kanban">Открыть канбан</Link></div><p className={styles.panelNote}>Те же задачи, статусы и ответственные, что на доске. Выполненные и отмененные находятся в закрытых.</p><div className={styles.taskFilters}>{FILTERS.map(option => <button key={option.value} type="button" aria-pressed={filter === option.value} className={filter === option.value ? styles.activeFilter : ""} onClick={() => setFilter(option.value)}>{option.label}<span>{operationTasks(data, option.value).length}</span></button>)}</div><TaskList tasks={tasks} busyId={busy} onEdit={task => setModal({ task })} onStatus={status} timeZone="Europe/Moscow" /></section>
      {data.missing_dates.length > 0 && <details className={styles.missing}><summary><AlertTriangle size={17} />Проверить даты поездок · {data.missing_dates.length}</summary><ul>{data.missing_dates.map(trip => <li key={trip.key}><Link href={trip.href}>{trip.name}</Link><span>{trip.issue}</span><small>{trip.manager_name}</small></li>)}</ul></details>}
    </>}
    {modal && <TaskModal columns={columns} defaultColumnId={columns.find(c => c.status === "new")?.id ?? null} task={modal.task} presetAssigneeId={modal.trip?.manager_id ?? undefined} presetLead={modal.trip?.lead_id ? { id: modal.trip.lead_id, name: modal.trip.name } : null} presetUonRecord={modal.trip && !modal.trip.lead_id && modal.trip.uon_id ? { kind: "request", id: modal.trip.uon_id, label: modal.trip.name } : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); void load(); }} />}
  </div>;
}
