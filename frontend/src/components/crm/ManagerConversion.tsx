import type { ManagementConversion, ManagementManagerRow } from "@/lib/managementDashboardApi";
import { formatConversionDifference, formatConversionPercent } from "@/lib/managementConversion";

const count = (value: number) => new Intl.NumberFormat("ru-RU").format(value);

export default function ManagerConversion({ rows, office, periodLabel }: {
  rows: ManagementManagerRow[];
  office: ManagementConversion;
  periodLabel: string;
}) {
  const managers = rows.filter(row => row.new_leads > 0 || row.sold > 0)
    .sort((a, b) => Number(a.manager_id === null) - Number(b.manager_id === null));

  return <section aria-label="Конверсия по менеджерам" className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-base font-bold text-navy">Конверсия по менеджерам</h2><p className="mt-1 text-sm text-foreground/55">{periodLabel} · продажи ÷ все входящие за период × 100%</p></div>
      <div className="rounded-2xl bg-blue-light/50 px-4 py-2 text-right"><p className="text-xs text-foreground/50">Офис в целом</p><p className="text-xl font-bold text-navy">{formatConversionPercent(office.percent)}</p></div>
    </div>
    {managers.length === 0 && <p className="mb-3 rounded-xl bg-blue-light/30 p-4 text-sm text-foreground/55">За выбранный период нет входящих и продаж по менеджерам.</p>}
    <div className="overflow-x-auto">
      <table className="w-full min-w-[690px] text-sm">
        <thead className="border-b border-black/10 text-left text-xs text-foreground/50"><tr>
          <th scope="col" className="px-3 py-3 font-medium">Менеджер</th>
          <th scope="col" className="px-3 py-3 text-right font-medium">Входящие</th>
          <th scope="col" className="px-3 py-3 text-right font-medium">Продажи</th>
          <th scope="col" className="px-3 py-3 text-right font-medium" title="Продажи за выбранный период по заявкам, созданным до его начала">Из прежних заявок</th>
          <th scope="col" className="px-3 py-3 text-right font-medium">Конверсия</th>
          <th scope="col" className="px-3 py-3 text-right font-medium" title="Разница с конверсией офиса в процентных пунктах">К офису, п.п.</th>
        </tr></thead>
        <tbody>{managers.map(row => {
          const delta = row.conversion_percent !== null && office.percent !== null ? row.conversion_percent - office.percent : null;
          return <tr key={row.manager_id ?? "unassigned"} className="border-b border-black/5">
            <th scope="row" className="px-3 py-4 text-left font-semibold text-navy">{row.manager_id === null ? "Без ответственного" : row.manager_name}</th>
            <td className="px-3 py-4 text-right text-foreground/70">{count(row.new_leads)}</td>
            <td className="px-3 py-4 text-right font-medium text-navy">{count(row.sold)}</td>
            <td className="px-3 py-4 text-right text-foreground/55">{count(row.previous_period_sales_count)}</td>
            <td className="px-3 py-4 text-right text-lg font-bold text-navy">{formatConversionPercent(row.conversion_percent)}</td>
            <td className={`px-3 py-4 text-right text-xs font-medium ${delta !== null && delta > 0 ? "text-emerald-700" : delta !== null && delta < 0 ? "text-amber-700" : "text-foreground/50"}`}>{formatConversionDifference(row.conversion_percent, office.percent)}</td>
          </tr>;
        })}</tbody>
        <tfoot className="bg-blue-light/35 font-semibold text-navy"><tr>
          <th scope="row" className="px-3 py-3 text-left">Всего по офису</th>
          <td className="px-3 py-3 text-right">{count(office.incoming_count)}</td>
          <td className="px-3 py-3 text-right">{count(office.sold_count)}</td>
          <td className="px-3 py-3 text-right">{count(office.previous_period_sales_count)}</td>
          <td className="px-3 py-3 text-right">{formatConversionPercent(office.percent)}</td>
          <td className="px-3 py-3 text-right">—</td>
        </tr></tfoot>
      </table>
    </div>
    <p className="mt-4 text-xs leading-5 text-foreground/50">Менеджер — текущий ответственный в заявке. Закрытые заявки остаются во входящих; продажи по прежним заявкам могут дать результат выше 100%. Без входящих процент не рассчитывается. Итог офиса считается по сумме продаж и входящих, а не как среднее процентов менеджеров.</p>
  </section>;
}
