"use client";

import { Search } from "lucide-react";
import type { CrmUser } from "@/lib/crmApi";

export type AssigneeFilter = "all" | "mine" | "unassigned" | number;
export type SortMode = "manual" | "deadline" | "priority";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  assigneeFilter: AssigneeFilter;
  onAssigneeFilterChange: (value: AssigneeFilter) => void;
  sortMode: SortMode;
  onSortModeChange: (value: SortMode) => void;
  managers: CrmUser[];
  resultCount: number;
};

export default function BoardToolbar({
  search,
  onSearchChange,
  assigneeFilter,
  onAssigneeFilterChange,
  sortMode,
  onSortModeChange,
  managers,
  resultCount,
}: Props) {
  const filtersActive = search.trim() !== "" || assigneeFilter !== "all" || sortMode !== "manual";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск по задачам, обращениям, клиентам…"
          className="w-72 rounded-xl border border-black/10 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue"
        />
      </div>

      <select
        value={String(assigneeFilter)}
        onChange={(e) => {
          const v = e.target.value;
          onAssigneeFilterChange(v === "all" || v === "mine" || v === "unassigned" ? v : Number(v));
        }}
        className="rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
      >
        <option value="all">Все ответственные</option>
        <option value="mine">Мои задачи</option>
        <option value="unassigned">Без менеджера</option>
        {managers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.full_name}
          </option>
        ))}
      </select>

      <select
        value={sortMode}
        onChange={(e) => onSortModeChange(e.target.value as SortMode)}
        className="rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-blue"
      >
        <option value="manual">Порядок на доске</option>
        <option value="deadline">По сроку (ближайшие сначала)</option>
        <option value="priority">По приоритету</option>
      </select>

      {filtersActive && (
        <>
          <span className="text-xs text-foreground/50">Найдено: {resultCount}</span>
          <button
            type="button"
            onClick={() => {
              onSearchChange("");
              onAssigneeFilterChange("all");
              onSortModeChange("manual");
            }}
            className="text-xs font-medium text-blue hover:underline"
          >
            Сбросить
          </button>
        </>
      )}
    </div>
  );
}
