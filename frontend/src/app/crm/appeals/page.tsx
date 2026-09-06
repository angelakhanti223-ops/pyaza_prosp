"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";
import { listUonLeads, type UonLeadRecord } from "@/lib/uonApi";
import { listColumns, type KanbanColumn } from "@/lib/kanbanApi";
import TaskModal from "@/components/kanban/TaskModal";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-black/5 py-2 text-sm last:border-0">
      <dt className="text-foreground/50">{label}</dt>
      <dd className="text-right text-navy">{value || "—"}</dd>
    </div>
  );
}

function LeadDetailModal({
  lead,
  columns,
  onClose,
}: {
  lead: UonLeadRecord;
  columns: KanbanColumn[];
  onClose: () => void;
}) {
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskCreated, setTaskCreated] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-dark/60 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"
      >
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-4 top-4 text-foreground/40 hover:text-foreground"
        >
          <X size={20} />
        </button>

        <h3 className="mb-1 text-lg font-bold text-navy">{lead.client_name || `Обращение #${lead.uon_id}`}</h3>
        <p className="mb-4 text-xs text-foreground/40">Обращение в U-ON · ID: {lead.uon_id}</p>

        <dl>
          <DetailRow label="Статус в U-ON" value={lead.status_name} />
          <DetailRow label="Менеджер" value={lead.manager_name} />
          <DetailRow label="Телефон" value={lead.client_phone} />
          <DetailRow label="Email" value={lead.client_email} />
          <DetailRow label="Источник" value={lead.source_name} />
          <DetailRow label="В архиве" value={lead.is_archive ? "Да" : "Нет"} />
          <DetailRow label="Заметки" value={lead.notes} />
          <DetailRow
            label="Создано в U-ON"
            value={lead.uon_created_at ? new Date(lead.uon_created_at).toLocaleString("ru-RU") : ""}
          />
        </dl>

        <p className="mt-4 text-xs text-foreground/40">
          Обновлено: {new Date(lead.synced_at).toLocaleString("ru-RU")}
        </p>

        <div className="mt-4 border-t border-black/5 pt-4">
          <button
            onClick={() => {
              setShowTaskModal(true);
              setTaskCreated(false);
            }}
            className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-blue"
          >
            + Создать задачу
          </button>
          {taskCreated && (
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-green-700">
              <Check size={13} />
              Задача создана — найдёте её на канбан-доске
            </p>
          )}
        </div>
      </div>

      {showTaskModal && (
        <TaskModal
          columns={columns}
          defaultColumnId={columns[0]?.id ?? null}
          task={null}
          presetUonRecord={{ kind: "lead", id: lead.uon_id, label: lead.client_name || `#${lead.uon_id}` }}
          onClose={() => setShowTaskModal(false)}
          onSaved={() => {
            setShowTaskModal(false);
            setTaskCreated(true);
          }}
        />
      )}
    </div>
  );
}

function CrmAppealsContent() {
  const [leads, setLeads] = useState<UonLeadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UonLeadRecord | null>(null);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("uon_id");

  useEffect(() => {
    listColumns().then(setColumns);
  }, []);

  useEffect(() => {
    let active = true;
    listUonLeads()
      .then((data) => {
        if (!active) return;
        setLeads(data);
        if (highlightId) {
          const match = data.find((l) => l.uon_id === highlightId);
          if (match) setSelected(match);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Обращения</h1>
          <p className="mt-1 text-xs text-foreground/50">
            Read-only зеркало обращений (лидов) из U-ON — самая ранняя стадия контакта, до того как менеджер начнёт
            вести полноценную заявку. Данные редактируются в U-ON, здесь только просмотр — обновляются кнопкой
            «Синхронизировать с U-ON» вверху страницы или мгновенно вебхуком при изменении в U-ON. Нажмите на
            строку, чтобы увидеть все поля.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-blue-light/40 text-xs text-foreground/50">
            <tr>
              <th className="px-4 py-3 font-medium">Клиент</th>
              <th className="px-4 py-3 font-medium">Телефон</th>
              <th className="px-4 py-3 font-medium">Статус в U-ON</th>
              <th className="px-4 py-3 font-medium">Менеджер</th>
              <th className="px-4 py-3 font-medium">Источник</th>
              <th className="px-4 py-3 font-medium">Создано</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => setSelected(lead)}
                className={`cursor-pointer border-b border-black/5 last:border-0 hover:bg-blue-light/20 ${
                  lead.uon_id === highlightId ? "bg-gold/10" : ""
                }`}
              >
                <td className="px-4 py-3 font-medium text-navy">{lead.client_name || `#${lead.uon_id}`}</td>
                <td className="px-4 py-3 text-foreground/70">{lead.client_phone || "—"}</td>
                <td className="px-4 py-3 text-foreground/70">{lead.status_name || "—"}</td>
                <td className="px-4 py-3 text-foreground/70">{lead.manager_name || "—"}</td>
                <td className="px-4 py-3 text-foreground/50">{lead.source_name || "—"}</td>
                <td className="px-4 py-3 text-foreground/50">
                  {lead.uon_created_at ? new Date(lead.uon_created_at).toLocaleDateString("ru-RU") : "—"}
                </td>
              </tr>
            ))}
            {!loading && leads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-foreground/40">
                  Обращений пока нет — нажмите «Синхронизировать с U-ON» вверху страницы
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <LeadDetailModal lead={selected} columns={columns} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

export default function CrmAppealsPage() {
  return (
    <Suspense fallback={null}>
      <CrmAppealsContent />
    </Suspense>
  );
}
