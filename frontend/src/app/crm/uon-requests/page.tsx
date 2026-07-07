"use client";

import { useEffect, useState } from "react";
import { listUonRequests, type UonRequestRecord } from "@/lib/uonApi";

export default function CrmUonRequestsPage() {
  const [requests, setRequests] = useState<UonRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listUonRequests()
      .then((data) => {
        if (active) setRequests(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
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
            страницы или мгновенно вебхуком при изменении в U-ON.
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
              <tr key={req.id} className="border-b border-black/5 last:border-0 hover:bg-blue-light/20">
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
    </div>
  );
}
