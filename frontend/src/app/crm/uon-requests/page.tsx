"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { listUonRequests, type UonRequestRecord } from "@/lib/uonApi";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-black/5 py-2 text-sm last:border-0">
      <dt className="text-foreground/50">{label}</dt>
      <dd className="text-right text-navy">{value || "—"}</dd>
    </div>
  );
}

function RequestDetailModal({ request, onClose }: { request: UonRequestRecord; onClose: () => void }) {
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

        <h3 className="mb-1 text-lg font-bold text-navy">
          {request.client_name || `Заявка #${request.uon_id}`}
        </h3>
        <p className="mb-4 text-xs text-foreground/40">Заявка в U-ON · ID: {request.uon_id}</p>

        <dl>
          <DetailRow label="Статус в U-ON" value={request.status_name} />
          <DetailRow label="Менеджер" value={request.manager_name} />
          <DetailRow label="Телефон" value={request.client_phone} />
          <DetailRow label="Email" value={request.client_email} />
          <DetailRow label="Номер брони" value={request.reservation_number} />
          <DetailRow label="Источник" value={request.source_name} />
          <DetailRow label="В архиве" value={request.is_archive ? "Да" : "Нет"} />
          <DetailRow label="Заметки" value={request.notes} />
          <DetailRow
            label="Создано в U-ON"
            value={request.uon_created_at ? new Date(request.uon_created_at).toLocaleString("ru-RU") : ""}
          />
        </dl>

        <p className="mt-4 text-xs text-foreground/40">
          Обновлено: {new Date(request.synced_at).toLocaleString("ru-RU")}
        </p>
      </div>
    </div>
  );
}

function CrmUonRequestsContent() {
  const [requests, setRequests] = useState<UonRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UonRequestRecord | null>(null);
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("uon_id");

  useEffect(() => {
    let active = true;
    listUonRequests()
      .then((data) => {
        if (!active) return;
        setRequests(data);
        if (highlightId) {
          const match = data.find((r) => r.uon_id === highlightId);
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
          <h1 className="text-xl font-bold text-navy">Заявки U-ON</h1>
          <p className="mt-1 text-xs text-foreground/50">
            Read-only зеркало заявок из U-ON — полноценные рабочие сделки (статус, бронирование, суммы), которые
            менеджер уже ведёт. Не путать со страницей «Заявки» — там ваши собственные CRM-заявки с сайта. Данные
            редактируются в U-ON, здесь только просмотр — обновляются кнопкой «Синхронизировать с U-ON» вверху
            страницы или мгновенно вебхуком при изменении в U-ON. Нажмите на строку, чтобы увидеть все поля.
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
              <th className="px-4 py-3 font-medium">Номер брони</th>
              <th className="px-4 py-3 font-medium">В архиве</th>
              <th className="px-4 py-3 font-medium">Создано</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr
                key={req.id}
                onClick={() => setSelected(req)}
                className={`cursor-pointer border-b border-black/5 last:border-0 hover:bg-blue-light/20 ${
                  req.uon_id === highlightId ? "bg-gold/10" : ""
                }`}
              >
                <td className="px-4 py-3 font-medium text-navy">{req.client_name || `#${req.uon_id}`}</td>
                <td className="px-4 py-3 text-foreground/70">{req.client_phone || "—"}</td>
                <td className="px-4 py-3 text-foreground/70">{req.status_name || "—"}</td>
                <td className="px-4 py-3 text-foreground/70">{req.manager_name || "—"}</td>
                <td className="px-4 py-3 text-foreground/50">{req.reservation_number || "—"}</td>
                <td className="px-4 py-3 text-foreground/50">{req.is_archive ? "Да" : "Нет"}</td>
                <td className="px-4 py-3 text-foreground/50">
                  {req.uon_created_at ? new Date(req.uon_created_at).toLocaleDateString("ru-RU") : "—"}
                </td>
              </tr>
            ))}
            {!loading && requests.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-foreground/40">
                  Заявок пока нет — нажмите «Синхронизировать с U-ON» вверху страницы
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <RequestDetailModal request={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default function CrmUonRequestsPage() {
  return (
    <Suspense fallback={null}>
      <CrmUonRequestsContent />
    </Suspense>
  );
}
