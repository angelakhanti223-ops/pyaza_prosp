"use client";

import { useEffect, useState } from "react";
import { listUonClients, type UonClientRecord } from "@/lib/uonApi";

export default function CrmClientsPage() {
  const [clients, setClients] = useState<UonClientRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listUonClients()
      .then((data) => {
        if (active) setClients(data);
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
          <h1 className="text-xl font-bold text-navy">Клиенты</h1>
          <p className="mt-1 text-xs text-foreground/50">
            Read-only зеркало клиентов из U-ON (собирается из данных заявок — в API U-ON нет отдельного
            /client-эндпоинта). Данные редактируются в U-ON, здесь только просмотр — обновляются кнопкой
            «Синхронизировать с U-ON» вверху страницы или мгновенно вебхуком при изменении в U-ON.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-blue-light/40 text-xs text-foreground/50">
            <tr>
              <th className="px-4 py-3 font-medium">Имя</th>
              <th className="px-4 py-3 font-medium">Телефон</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Обновлён</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-b border-black/5 last:border-0 hover:bg-blue-light/20">
                <td className="px-4 py-3 font-medium text-navy">{client.name || `#${client.uon_id}`}</td>
                <td className="px-4 py-3 text-foreground/70">{client.phone || "—"}</td>
                <td className="px-4 py-3 text-foreground/70">{client.email || "—"}</td>
                <td className="px-4 py-3 text-foreground/50">
                  {new Date(client.synced_at).toLocaleDateString("ru-RU")}
                </td>
              </tr>
            ))}
            {!loading && clients.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-foreground/40">
                  Клиентов пока нет — нажмите «Синхронизировать с U-ON» вверху страницы
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
