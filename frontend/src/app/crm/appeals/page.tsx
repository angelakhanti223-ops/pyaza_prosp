"use client";

import { useEffect, useState } from "react";
import { listUonLeads, type UonLeadRecord } from "@/lib/uonApi";

export default function CrmAppealsPage() {
  const [leads, setLeads] = useState<UonLeadRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listUonLeads()
      .then((data) => {
        if (active) setLeads(data);
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
            Read-only зеркало обращений (лидов) из U-ON — самая ранняя стадия контакта, до того как менеджер начнёт
            вести полноценную заявку. Данные редактируются в U-ON, здесь только просмотр — обновляются кнопкой
            «Синхронизировать с U-ON» вверху страницы или мгновенно вебхуком при изменении в U-ON.
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
              <tr key={lead.id} className="border-b border-black/5 last:border-0 hover:bg-blue-light/20">
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
    </div>
  );
}
