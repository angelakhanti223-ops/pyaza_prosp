import { Suspense } from "react";
import Board from "@/components/kanban/Board";

export default function CrmKanbanPage() {
  return (
    <div>
      <h1 className="mb-5 text-xl font-bold text-navy">Канбан-доска</h1>
      <Suspense fallback={<p className="text-sm text-foreground/50">Загрузка доски…</p>}>
        <Board />
      </Suspense>
    </div>
  );
}
