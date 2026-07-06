"use client";

import { useEffect, useState } from "react";
import { listUonDeals, type UonDealRecord } from "@/lib/uonApi";

export default function CrmAppealsPage() {
  const [deals, setDeals] = useState<UonDealRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listUonDeals()
      .then((data) => {
        if (active) setDeals(data);
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
          <h1 className="text-xl font-bold text-navy">Обращения</h1>
          <p className="mt-1 text-xs text-foreground/50">
            Read-only зеркало сделок (обращений) из U-ON. Данные редактируются в U-ON, здесь только просмотр —
            обновляются кнопкой «Синхронизировать с U-ON» вверху страницы.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-blue-light/40 text-xs text-foreground/50">
            <tr>
              <th className="px-4 py-3 font-medium">Название</th>
              <th className="px-4 py-3 font-medium">Статус в U-ON</th>
              <th className="px-4 py-3 font-medium">Менеджер</th>
              <th className="px-4 py-3 font-medium">Сумма</th>
              <th className="px-4 py-3 font-medium">Заявка (U-ON)</th>
              <th className="px-4 py-3 font-medium">Создано</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr key={deal.id} className="border-b border-black/5 last:border-0 hover:bg-blue-light/20">
                <td className="px-4 py-3 font-medium text-navy">{deal.name || `#${deal.uon_id}`}</td>
                <td className="px-4 py-3 text-foreground/70">{deal.status_name || "—"}</td>
                <td className="px-4 py-3 text-foreground/70">{deal.manager_name || "—"}</td>
                <td className="px-4 py-3 text-foreground/70">{deal.amount ? `${deal.amount} ₽` : "—"}</td>
                <td className="px-4 py-3 text-foreground/50">{deal.request_uon_id || "—"}</td>
                <td className="px-4 py-3 text-foreground/50">
                  {deal.uon_created_at ? new Date(deal.uon_created_at).toLocaleDateString("ru-RU") : "—"}
                </td>
              </tr>
            ))}
            {!loading && deals.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-foreground/40">
                  Обращений пока нет — нажмите «Синхронизировать с U-ON» вверху страницы
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
