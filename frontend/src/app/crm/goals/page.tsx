"use client";

import { useEffect, useMemo, useState } from "react";
import OfficeGoalsBoard from "@/components/crm/OfficeGoalsBoard";
import { fetchManagementDashboard, type ManagementDashboardData } from "@/lib/managementDashboardApi";
import { fetchOfficeGoals, updateOfficeGoals, type OfficeGoalsData } from "@/lib/officeGoalsApi";

export default function OfficeGoalsPage() {
  const [selectedMonth, setSelectedMonth] = useState(11);
  const month = useMemo(() => ({ year: 2026, month: selectedMonth }), [selectedMonth]);
  const [goals, setGoals] = useState<OfficeGoalsData | null>(null);
  const [data, setData] = useState<ManagementDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [receipts, setReceipts] = useState("");
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const requests = [
      fetchManagementDashboard("custom_month", month).then(result => {
        const prefix = `2026-${selectedMonth}-`;
        if (!result.period.from.startsWith(`${prefix}01`) || !result.period.to.startsWith(`${prefix}${new Date(2026, selectedMonth, 0).getDate()}`)) throw new Error("Факт за выбранный месяц пока недоступен.");
        if (active) setData(result);
      }).catch(err => { if (active) setError(err instanceof Error ? err.message : "Не удалось загрузить показатели"); }),
      fetchOfficeGoals(month).then(result => {
        if (active) { setGoals(result); setReceipts(result.commission_receipts_actual === null ? "" : String(result.commission_receipts_actual)); }
      }).catch(err => { if (active) setError(err instanceof Error ? err.message : "Не удалось загрузить цели"); }),
    ];
    Promise.all(requests).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, selectedMonth, retry]);

  async function save(values: Parameters<typeof updateOfficeGoals>[1]) {
    if (saving) return;
    setSaving(true); setError(""); setSaveMessage("");
    try { setGoals(await updateOfficeGoals(month, values)); setSaveMessage("Сохранено"); }
    catch (err) { setError(err instanceof Error ? err.message : "Не удалось сохранить изменения"); }
    finally { setSaving(false); }
  }

  function changeMonth(value: number) {
    if (saving || value === selectedMonth) return;
    setSelectedMonth(value); setGoals(null); setData(null); setError(""); setSaveMessage(""); setReceipts(""); setLoading(true);
  }

  return <OfficeGoalsBoard month={selectedMonth} goals={goals} data={data} loading={loading} saving={saving} receipts={receipts} error={error} saveMessage={saveMessage}
    onMonth={changeMonth} onReceipts={setReceipts} onToggle={(id, checked) => { void save({ activity_id: id, completed: checked }); }}
    onSaveReceipts={() => { void save({ commission_receipts_actual: receipts === "" ? null : receipts }); }}
    onRetry={() => { setError(""); setData(null); setLoading(true); setRetry(n => n + 1); }} />;
}
