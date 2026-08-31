"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import {
  listUonManagers,
  listUonRequests,
  listUonStatuses,
  type UonCatalogItem,
  type UonRequestRecord,
} from "@/lib/uonApi";
import { pushUonRequestUpdate } from "@/lib/crmApi";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-black/5 py-2 text-sm last:border-0">
      <dt className="text-foreground/50">{label}</dt>
      <dd className="text-right text-navy">{value || "—"}</dd>
    </div>
  );
}

function RequestDetailModal({
  request,
  onClose,
  onUpdated,
}: {
  request: UonRequestRecord;
  onClose: () => void;
  onUpdated: (updated: UonRequestRecord) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [statuses, setStatuses] = useState<UonCatalogItem[]>([]);
  const [managers, setManagers] = useState<UonCatalogItem[]>([]);
  const [catalogsLoading, setCatalogsLoading] = useState(false);
  const [statusId, setStatusId] = useState(request.status_id);
  const [managerId, setManagerId] = useState("");
  const [reservationNumber, setReservationNumber] = useState(request.reservation_number);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setEditing(true);
    setError(null);
    setStatusId(request.status_id);
    setManagerId("");
    setReservationNumber(request.reservation_number);
    if (statuses.length === 0 && managers.length === 0) {
      setCatalogsLoading(true);
      Promise.all([listUonStatuses(), listUonManagers()])
        .then(([statusList, managerList]) => {
          setStatuses(statusList);
          setManagers(managerList);
        })
        .catch(() => setError("Не удалось загрузить справочники U-ON"))
        .finally(() => setCatalogsLoading(false));
    }
  }

  async function handleSave() {
    const payload: Partial<{ status_id: string; manager_id: string; reservation_number: string }> = {};
    if (statusId && statusId !== request.status_id) payload.status_id = statusId;
    if (managerId) payload.manager_id = managerId;
    if (reservationNumber !== request.reservation_number) payload.reservation_number = reservationNumber;

    if (Object.keys(payload).length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await pushUonRequestUpdate(request.id, payload);
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  }

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

        {!editing ? (
          <>
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

            <button
              onClick={startEditing}
              className="mt-4 rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-navy-dark"
            >
              Изменить статус / менеджера / номер брони
            </button>
          </>
        ) : (
          <div className="space-y-3">
            {catalogsLoading && <p className="text-xs text-foreground/40">Загрузка справочников U-ON…</p>}

            <label className="block text-xs text-foreground/50">
              Статус
              <select
                value={statusId}
                onChange={(e) => setStatusId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-navy"
              >
                <option value="">— не менять ({request.status_name || "нет"}) —</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs text-foreground/50">
              Ответственный менеджер
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-navy"
              >
                <option value="">— не менять ({request.manager_name || "нет"}) —</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs text-foreground/50">
              Номер брони
              <input
                value={reservationNumber}
                onChange={(e) => setReservationNumber(e.target.value)}
                className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-navy"
              />
            </label>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-navy-dark disabled:opacity-50"
              >
                {saving ? "Сохранение…" : "Сохранить в U-ON"}
              </button>
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-foreground/60 hover:bg-black/5"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

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
            Зеркало заявок из U-ON — полноценные рабочие сделки (статус, бронирование, суммы), которые
            менеджер уже ведёт. Не путать со страницей «Заявки» — там ваши собственные CRM-заявки с сайта. Большинство
            полей приходят из U-ON и обновляются кнопкой «Синхронизировать с U-ON» вверху страницы или мгновенно
            вебхуком; статус, ответственного и номер брони можно отправить обратно в U-ON прямо из карточки заявки.
            Нажмите на строку, чтобы увидеть все поля.
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

      {selected && (
        <RequestDetailModal
          request={selected}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setSelected(updated);
            setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          }}
        />
      )}
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
