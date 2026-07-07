"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { listUonClients, type UonClientRecord } from "@/lib/uonApi";

function fullName(client: UonClientRecord): string {
  return [client.surname, client.name, client.patronymic].filter(Boolean).join(" ");
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("ru-RU") : "—";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-black/5 py-2 text-sm last:border-0">
      <dt className="text-foreground/50">{label}</dt>
      <dd className="text-right text-navy">{value || "—"}</dd>
    </div>
  );
}

function ClientDetailModal({ client, onClose }: { client: UonClientRecord; onClose: () => void }) {
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

        <h3 className="mb-1 text-lg font-bold text-navy">{fullName(client) || `Клиент #${client.uon_id}`}</h3>
        <p className="mb-4 text-xs text-foreground/40">
          {client.is_main_contact ? "Основной заказчик" : "Сопутствующий турист"} · ID в U-ON: {client.uon_id}
        </p>

        <dl>
          <DetailRow label="ФИО (лат.)" value={[client.surname_en, client.name_en].filter(Boolean).join(" ")} />
          <DetailRow label="Пол" value={client.sex} />
          <DetailRow label="Дата рождения" value={formatDate(client.birthday)} />
          <DetailRow label="Телефон" value={client.phone} />
          <DetailRow label="Доп. телефон" value={client.phone_home} />
          <DetailRow label="Email" value={client.email} />
          <DetailRow label="Telegram" value={client.telegram} />
          <DetailRow label="WhatsApp" value={client.whatsapp} />
          <DetailRow label="Viber" value={client.viber} />
          <DetailRow label="ВКонтакте" value={client.social_vk} />
          <DetailRow label="Instagram" value={client.instagram} />
          <DetailRow label="Паспорт (номер)" value={client.passport_number} />
          <DetailRow label="Паспорт (кем выдан)" value={client.passport_issued_by} />
          <DetailRow label="Паспорт (дата выдачи)" value={formatDate(client.passport_date)} />
          <DetailRow label="Загранпаспорт (номер)" value={client.zagran_number} />
          <DetailRow label="Загранпаспорт (действителен до)" value={formatDate(client.zagran_expire)} />
          <DetailRow label="Адрес" value={client.address} />
          <DetailRow label="Страна" value={client.country} />
          <DetailRow label="Город" value={client.city} />
          <DetailRow label="Гражданство" value={client.nationality} />
          <DetailRow label="Компания" value={client.company} />
          <DetailRow label="ИНН" value={client.inn} />
          <DetailRow label="Заметки" value={client.notes} />
        </dl>

        <p className="mt-4 text-xs text-foreground/40">
          Обновлено: {new Date(client.synced_at).toLocaleString("ru-RU")}
        </p>
      </div>
    </div>
  );
}

export default function CrmClientsPage() {
  const [clients, setClients] = useState<UonClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UonClientRecord | null>(null);

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
            Read-only зеркало клиентов и туристов из заявок U-ON (паспорт, загранпаспорт, дата рождения, адрес,
            соцсети и т.д. — самый полный набор данных, доступный в API). Данные редактируются в U-ON, здесь только
            просмотр — обновляются кнопкой «Синхронизировать с U-ON» вверху страницы или мгновенно вебхуком.
            Нажмите на строку, чтобы увидеть все поля.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-blue-light/40 text-xs text-foreground/50">
            <tr>
              <th className="px-4 py-3 font-medium">ФИО</th>
              <th className="px-4 py-3 font-medium">Телефон</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Дата рождения</th>
              <th className="px-4 py-3 font-medium">Город</th>
              <th className="px-4 py-3 font-medium">Роль</th>
              <th className="px-4 py-3 font-medium">Обновлён</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr
                key={client.id}
                onClick={() => setSelected(client)}
                className="cursor-pointer border-b border-black/5 last:border-0 hover:bg-blue-light/20"
              >
                <td className="px-4 py-3 font-medium text-navy">{fullName(client) || `#${client.uon_id}`}</td>
                <td className="px-4 py-3 text-foreground/70">{client.phone || "—"}</td>
                <td className="px-4 py-3 text-foreground/70">{client.email || "—"}</td>
                <td className="px-4 py-3 text-foreground/70">{formatDate(client.birthday)}</td>
                <td className="px-4 py-3 text-foreground/70">{client.city || "—"}</td>
                <td className="px-4 py-3 text-foreground/50">
                  {client.is_main_contact ? "Заказчик" : "Турист"}
                </td>
                <td className="px-4 py-3 text-foreground/50">
                  {new Date(client.synced_at).toLocaleDateString("ru-RU")}
                </td>
              </tr>
            ))}
            {!loading && clients.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-foreground/40">
                  Клиентов пока нет — нажмите «Синхронизировать с U-ON» вверху страницы
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <ClientDetailModal client={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
