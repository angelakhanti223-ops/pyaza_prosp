import type { ManagementConversion } from "./managementDashboardApi";

export function formatConversionPercent(value: number | null): string {
  return value === null ? "—" : `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value)}%`;
}

export function conversionExplanation(metric: ManagementConversion): string {
  const base = `Продажи периода: ${metric.sold_count}. Все входящие периода: ${metric.incoming_count}.`;
  const previous = metric.previous_period_sales_count > 0 ? ` Продаж по заявкам прошлых периодов: ${metric.previous_period_sales_count}.` : "";
  return `${base}${previous}${metric.incoming_count === 0 ? " Без входящих процент не рассчитывается." : ""}`;
}

export const CONVERSION_RULE = "Продажи периода ÷ все входящие того же периода × 100%. Продажа учитывается один раз при первом переходе в предоплату, оплату или «Успешная». Закрытые заявки остаются во входящих. Показатель учитывает продажи по прежним заявкам и может превышать 100%.";
