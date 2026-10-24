import type { KanbanColumn, KanbanTask } from "./kanbanApi";

export function previewTaskMove(tasks: KanbanTask[], taskId: number, column: KanbanColumn) {
  return tasks.map(task => task.id === taskId ? { ...task, column: column.id, status: column.status, status_display: column.name } : task);
}

export function dropIndex(tasks: KanbanTask[], taskId: number, columnId: number, overId: string | number) {
  const task = tasks.find(item => item.id === taskId);
  const original = tasks.filter(item => item.column === columnId).sort((a, b) => a.order - b.order);
  const target = original.filter(item => item.id !== taskId);
  const over = target.findIndex(item => item.id === Number(overId));
  if (over < 0) return target.length;
  if (task?.column === columnId && original.findIndex(item => item.id === taskId) < original.findIndex(item => item.id === Number(overId))) return over + 1;
  return over;
}

function moscowDay(value: Date) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (name: string) => parts.find(item => item.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function matchesTaskDate(task: Pick<KanbanTask, "deadline" | "status">, filter: "all" | "today" | "week" | "overdue", now = new Date()) {
  if (filter === "all") return true;
  if (!task.deadline || task.status === "done" || task.status === "cancelled") return false;
  const date = new Date(task.deadline);
  if (Number.isNaN(date.getTime())) return false;
  if (filter === "overdue") return date.getTime() < now.getTime();
  const today = moscowDay(now), day = moscowDay(date);
  if (filter === "today") return day === today;
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return day >= today && day <= end.toISOString().slice(0, 10);
}
