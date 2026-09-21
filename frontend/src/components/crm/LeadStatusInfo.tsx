import type { LeadStatus } from "@/lib/crmApi";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Новая",
  follow_up: "Назначена повторная связь",
  in_progress: "В работе",
  selection: "Подборка",
  options_proposed: "Предложены варианты",
  booked: "Бронь",
  prepaid: "Внесена предоплата",
  waiting_payment: "Ожидаем полной оплаты",
  paid: "Оплачено",
  departure: "Вылет",
  check_in: "Заселение",
  returned: "Прилет",
  closed_won: "Успешная",
  closed_lost: "Неуспешная",
  failed: "Провалена",
  not_target: "Нецелевой",
};

export const LEAD_STATUS_HINTS: Record<LeadStatus, string> = {
  new: "Заявка только поступила. Нужно связаться с клиентом и уточнить запрос.",
  follow_up: "Клиент ждёт звонка или сообщения в конкретную дату. Обязательно заполните следующий контакт.",
  in_progress: "Уточняем параметры тура: даты, город вылета, состав туристов, бюджет и пожелания.",
  selection: "Готовим подборку или собираем варианты. Без даты повторной связи заявка легко теряется.",
  options_proposed: "Варианты отправлены клиенту. Следующий шаг — получить обратную связь и решение.",
  booked: "Тур выбран и забронирован или удерживается. Нужны туроператор, номер брони, сумма и дедлайн оплаты.",
  prepaid: "Получена часть оплаты. Заполните предоплату, оплачено, остаток и дату полной оплаты.",
  waiting_payment: "Ждём доплату до дедлайна. Контролируйте остаток и срок полной оплаты.",
  paid: "Тур полностью оплачен. Проверьте документы, ваучеры, билеты и памятку туристу.",
  departure: "Турист улетает или уже улетел. Проверьте, что нет проблем с перелётом и документами.",
  check_in: "Контроль заселения: уточнить, всё ли хорошо с номером, питанием и отелем.",
  returned: "Турист вернулся. Запросите отзыв, фото и отметьте потенциал повторной продажи.",
  closed_won: "Продажа успешно завершена. Комиссия и итог по заявке должны быть зафиксированы.",
  closed_lost: "Нормальная продажная заявка, но клиент не купил. Укажите причину: дорого, выбрал другого, передумал и т.п.",
  failed: "Заявка потеряна из-за процесса: не перезвонили, забыли, долго отвечали, не отправили подборку. Укажите причину.",
  not_target: "Обращение не является потенциальной продажей: спам, дубль, ошибочный номер, работа, сотрудничество и т.п.",
};

export function getLeadStatusLabel(status: LeadStatus, fallback?: string) {
  return LEAD_STATUS_LABELS[status] ?? fallback ?? status;
}

export function getLeadStatusHint(status: LeadStatus) {
  return LEAD_STATUS_HINTS[status];
}

export function LeadStatusHint({ status }: { status: LeadStatus }) {
  return (
    <p className="mt-2 rounded-xl bg-blue-light/40 px-3 py-2 text-xs leading-relaxed text-foreground/65">
      {getLeadStatusHint(status)}
    </p>
  );
}
