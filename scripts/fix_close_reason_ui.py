from pathlib import Path

PAGE_PATH = Path("frontend/src/app/crm/leads/[id]/page.tsx")

REASON_CONSTANTS = '''
const CLOSE_REASON_OPTIONS_BY_STATUS: Partial<Record<LeadStatus, string[]>> = {
  closed_won: [
    "Клиент купил тур",
    "Купил сертификат",
    "Повторная продажа",
    "Полная оплата получена",
    "Другое",
  ],
  closed_lost: [
    "Дорого",
    "Выбрал другого агента",
    "Передумал",
    "Не подошли даты",
    "Не устроил отель",
    "Не вышел на связь",
    "Купил самостоятельно",
    "Другое",
  ],
  failed: [
    "Не перезвонили вовремя",
    "Забыли назначить следующий контакт",
    "Поздно отправили подборку",
    "Не проконтролировали оплату",
    "Потеряли в переписке",
    "Другое",
  ],
  not_target: [
    "Нет бюджета",
    "Не туризм",
    "Ошибочный контакт",
    "Спам",
    "Другое",
  ],
};
'''

CONTACT_OPTIONS_MARKER = '''const CONTACT_METHOD_OPTIONS: { value: ContactPreferredMethod; label: string }[] = [
  { value: "phone", label: "Телефон" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "max", label: "MAX" },
  { value: "vk", label: "ВК" },
  { value: "email", label: "Email" },
  { value: "other", label: "Другое" },
];'''

REASON_LABEL_LINE = '''  const reasonLabel = lead.status === "failed" ? "Причина провала" : lead.status === "closed_lost" ? "Причина неуспешной заявки" : lead.status === "not_target" ? "Причина нецелевого обращения" : "Причина закрытия";'''

TOP_STATUS_BLOCK_END = '''              <div>
                <FieldLabel>Направление</FieldLabel>
                <select value={lead.direction ?? ""} onChange={(e) => savePatch({ direction: e.target.value ? Number(e.target.value) : null }, "direction")} className={inputClass()}>
                  <option value="">Не указано</option>
                  {directions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
          </section>'''

TOP_STATUS_BLOCK_WITH_REASON = '''              <div>
                <FieldLabel>Направление</FieldLabel>
                <select value={lead.direction ?? ""} onChange={(e) => savePatch({ direction: e.target.value ? Number(e.target.value) : null }, "direction")} className={inputClass()}>
                  <option value="">Не указано</option>
                  {directions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            {isClosedStatus && (
              <div className="mt-4 rounded-xl bg-blue-light/30 p-3">
                <FieldLabel>{reasonLabel}</FieldLabel>
                <select
                  value={lead.failure_reason || ""}
                  onChange={(e) => savePatch({ failure_reason: e.target.value }, "failure_reason")}
                  className={inputClass()}
                >
                  <option value="">Выберите причину</option>
                  {closeReasonOptions.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
                {!lead.failure_reason && (
                  <p className="mt-1 text-xs text-red-600">Для закрытия нужна причина.</p>
                )}
              </div>
            )}
          </section>'''

OLD_PAYMENT_REASON_BLOCK = '''            {isClosedStatus && <div className="mt-4"><FieldLabel>{reasonLabel}</FieldLabel><textarea defaultValue={lead.failure_reason} onBlur={(e) => savePatch({ failure_reason: e.target.value }, "failure_reason")} rows={2} className="mt-1 w-full resize-none rounded-xl border border-black/10 p-3 text-sm outline-none focus:border-blue" />{!lead.failure_reason && <p className="mt-1 text-xs text-red-600">Для закрытия нужна причина.</p>}</div>}
'''


def main():
    text = PAGE_PATH.read_text(encoding="utf-8")

    if "CLOSE_REASON_OPTIONS_BY_STATUS" not in text:
        if CONTACT_OPTIONS_MARKER not in text:
            raise SystemExit("Не найден CONTACT_METHOD_OPTIONS: структура файла отличается от ожидаемой.")
        text = text.replace(CONTACT_OPTIONS_MARKER, CONTACT_OPTIONS_MARKER + "\n" + REASON_CONSTANTS)

    if "const closeReasonOptions =" not in text:
        if REASON_LABEL_LINE not in text:
            raise SystemExit("Не найдена строка reasonLabel: структура файла отличается от ожидаемой.")
        text = text.replace(
            REASON_LABEL_LINE,
            REASON_LABEL_LINE + '\n  const closeReasonOptions = CLOSE_REASON_OPTIONS_BY_STATUS[lead.status] ?? [];',
        )

    if 'value={lead.failure_reason || ""}' not in text:
        if TOP_STATUS_BLOCK_END not in text:
            raise SystemExit("Не найден верхний блок Статус/Ответственный/Направление.")
        text = text.replace(TOP_STATUS_BLOCK_END, TOP_STATUS_BLOCK_WITH_REASON)

    if OLD_PAYMENT_REASON_BLOCK in text:
        text = text.replace(OLD_PAYMENT_REASON_BLOCK, "")

    PAGE_PATH.write_text(text, encoding="utf-8")
    print("OK: причина закрытия перенесена к статусу и заменена на справочник")


if __name__ == "__main__":
    main()
