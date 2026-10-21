"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, FolderLock, Search, X } from "lucide-react";
import { useCrmAuth } from "./CrmAuthProvider";
import { CANDIDATE_STATUSES, candidatePdfUrl, listCandidates, updateCandidate, type Candidate } from "@/lib/candidatesApi";

const date = (value: string) => new Date(value).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", dateStyle: "short", timeStyle: "short" });
const button = "rounded-xl border border-navy/15 px-4 py-2 text-sm font-medium text-navy hover:bg-blue-light disabled:opacity-50";

export default function Candidates({ folder = false }: { folder?: boolean }) {
  const { user } = useCrmAuth();
  const [rows, setRows] = useState<Candidate[]>([]);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!user?.is_admin) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      listCandidates({ search, status, page }, controller.signal)
        .then(data => { setRows(data.results); setCount(data.count); })
        .catch(err => { if (!controller.signal.aborted) { setRows([]); setError(err.message); } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [user?.is_admin, search, status, page, revision]);

  useEffect(() => {
    if (!selected) return;
    function close(event: KeyboardEvent) { if (event.key === "Escape" && !saving) setSelected(null); }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected, saving]);

  if (!user?.is_admin) return <div className="rounded-2xl bg-white p-8 text-navy">Раздел доступен только администратору.</div>;

  async function save() {
    if (!selected) return;
    setSaving(true); setSaveError("");
    try { await updateCandidate(selected.id, { status: selected.status, notes: selected.notes }); setSelected(null); setRevision(value => value + 1); }
    catch (err) { setSaveError(err instanceof Error ? err.message : "Не удалось сохранить изменения."); }
    finally { setSaving(false); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 flex items-center gap-2 text-xs text-foreground/50"><FolderLock size={14} /> Только администратор · Concept Group</p>
        <h1 className="text-3xl font-bold text-navy">{folder ? "Анкеты PDF" : "Кандидаты"}</h1>
        <p className="mt-2 text-sm text-foreground/60">{folder ? "Закрытая папка заполненных анкет. Каждый файл содержит ответы и текст принятого согласия." : "Отклики из формы на сайте, заполненные анкеты и результаты рассмотрения."}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link className={button} href={folder ? "/crm/candidates" : "/crm/candidates/pdfs"}>{folder ? "К кандидатам" : "Папка «Анкеты PDF»"}</Link>
        <a className={button} href="/candidates" target="_blank" rel="noreferrer">Открыть форму ↗</a>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4">
      <label className="flex min-w-56 flex-1 items-center gap-2 rounded-xl border border-navy/15 px-3 py-2"><Search size={17} className="text-navy/40" /><input aria-label="Поиск кандидатов" className="w-full bg-transparent text-sm outline-none" placeholder="ФИО, телефон, город или должность" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label>
      <select aria-label="Статус кандидата" className={button} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Все статусы</option>{CANDIDATE_STATUSES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <button className={button} onClick={() => setRevision(value => value + 1)}>Обновить</button>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div aria-busy={loading} className="overflow-x-auto rounded-2xl border border-navy/5 bg-white">
      <table className="w-full text-left text-sm"><thead className="bg-blue-light/50 text-xs text-navy/60"><tr><th className="p-4">{folder ? "Файл" : "Кандидат"}</th><th className="p-4">Должность / город</th><th className="p-4">Получено, МСК</th><th className="p-4">Статус</th><th className="p-4">Анкета PDF</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={5} className="p-10 text-center text-foreground/50">Загружаем анкеты…</td></tr> : !rows.length ? <tr><td colSpan={5} className="p-10 text-center text-foreground/50">{search || status ? "По этим условиям анкеты не найдены." : "Пока нет анкет. После отправки формы здесь появятся кандидат и его PDF."}</td></tr> : rows.map(row => <tr key={row.id} className="border-t border-navy/5">
          <td className="p-4"><button onClick={() => { setSelected({ ...row }); setSaveError(""); }} className="font-semibold text-navy underline-offset-4 hover:underline">{folder && <FileText size={15} className="mr-1 inline" />}{row.full_name}{folder ? ".pdf" : ""}</button><p className="mt-1 text-xs text-foreground/50">{folder ? row.id : row.phone}</p></td>
          <td className="p-4">{row.position}<p className="mt-1 text-xs text-foreground/50">{row.city}</p></td><td className="whitespace-nowrap p-4">{date(row.created_at)}</td><td className="p-4"><span className="rounded-full bg-blue-light px-3 py-1 text-xs text-navy">{row.status_display}</span></td>
          <td className="p-4"><div className="flex gap-3"><a href={candidatePdfUrl(row)} target="_blank" rel="noreferrer" className="text-navy underline">Открыть</a><a href={candidatePdfUrl(row, true)} className="text-navy underline">Скачать</a></div></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="flex items-center justify-between text-sm text-foreground/60"><span>Всего анкет: {count}</span><div className="flex items-center gap-3"><button disabled={page === 1 || loading} onClick={() => setPage(value => value - 1)} className={button}>Назад</button><span>Страница {page}</span><button disabled={page * 20 >= count || loading} onClick={() => setPage(value => value + 1)} className={button}>Далее</button></div></div>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4" onClick={() => { if (!saving) setSelected(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="candidate-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={event => event.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs text-foreground/50">Карточка кандидата</p><h2 id="candidate-title" className="mt-1 text-xl font-bold text-navy">{selected.full_name}</h2></div><button autoFocus aria-label="Закрыть" disabled={saving} onClick={() => setSelected(null)} className={button}><X size={18} /></button></div>
        <dl className="mb-5 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-foreground/50">Должность</dt><dd>{selected.position}</dd></div><div><dt className="text-foreground/50">Город</dt><dd>{selected.city}</dd></div><div><dt className="text-foreground/50">Телефон</dt><dd>{selected.phone}</dd></div><div><dt className="text-foreground/50">Email</dt><dd className="break-all">{selected.email || "Не указан"}</dd></div></dl>
        <a className={`${button} mb-5 inline-flex items-center gap-2`} href={candidatePdfUrl(selected)} target="_blank" rel="noreferrer"><FileText size={17} /> Полная анкета и согласие в PDF ↗</a>
        <label className="mb-4 block text-sm">Статус<select disabled={saving} className={`${button} mt-2 block w-full`} value={selected.status} onChange={e => setSelected({ ...selected, status: e.target.value })}>{CANDIDATE_STATUSES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="mb-4 block text-sm">Заметки администратора<textarea disabled={saving} maxLength={10000} rows={4} className="mt-2 block w-full rounded-xl border border-navy/15 p-3" value={selected.notes} onChange={e => setSelected({ ...selected, notes: e.target.value })} /></label>
        <p className="mb-5 text-xs text-foreground/50">Согласие подтверждено: {date(selected.consent_at)} МСК.<br />Версия: {selected.consent_version}.</p>
        {saveError && <p role="alert" className="mb-4 text-sm text-red-700">{saveError}</p>}
        <button disabled={saving} onClick={save} className="rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Сохраняем…" : "Сохранить"}</button>
      </section>
    </div>}
  </div>;
}
