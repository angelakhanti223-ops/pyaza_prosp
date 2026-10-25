"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Gift, LoaderCircle } from "lucide-react";
import { ApiError, createGiftCertificateApplication } from "@/lib/api";
import consents from "@/content/giftConsents.json";

const amounts = [10000, 25000, 50000, 100000];
const rubles = (value: number) => new Intl.NumberFormat("ru-RU").format(value) + " ₽";
const inputClass = "mt-2 w-full rounded-xl border border-navy/15 bg-white px-4 py-3.5 text-base text-navy outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/15";

export default function GiftCertificateForm() {
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [name, setName] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "pending") return;
    const data = new FormData(event.currentTarget);
    setStatus("pending"); setErrors({});
    setName(String(data.get("name") ?? "").trim());
    try {
      await createGiftCertificateApplication({
        name: String(data.get("name") ?? "").trim(),
        phone: String(data.get("phone") ?? "").trim(),
        email: String(data.get("email") ?? "").trim(),
        comment: String(data.get("comment") ?? "").trim(),
        amount: amount ? Number(amount) : null,
        consent_personal_data: data.get("personal_data") === "on",
        consent_communication: data.get("personal_data") === "on",
        consent_marketing: data.get("marketing") === "on",
        consent_version: consents.version,
      });
      setStatus("success");
    } catch (error) {
      setStatus("error");
      if (error instanceof ApiError) setErrors(error.fieldErrors);
    }
  }

  if (status === "success") return (
    <div id="application" role="status" className="scroll-mt-28 rounded-[2rem] border border-navy/10 bg-white p-8 text-center shadow-xl shadow-navy/5 sm:p-12">
      <CheckCircle2 className="mx-auto mb-6 text-blue" size={48} />
      <h3 className="text-2xl font-bold text-navy">{name}, заявка отправлена!</h3>
      <p className="mt-4 leading-relaxed text-foreground/70">Обсудим сумму и оформление сертификата, ответим на вопросы и подскажем, как его получить.</p>
      <p className="mt-5 text-sm text-foreground/60">Мы на связи ежедневно с 9:00 до 21:00 по московскому времени.</p>
      <a href="tel:+79502302555" className="mt-6 inline-block font-semibold text-blue">+7 (950) 230-25-55</a>
    </div>
  );

  return (
    <form id="application" onSubmit={submit} className="scroll-mt-28 rounded-[2rem] border border-navy/10 bg-white p-6 shadow-xl shadow-navy/5 sm:p-9" aria-label="Заявка на подарочный сертификат">
      <div className="mb-7 flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-blue-light text-blue"><Gift size={22}/></span><div><h3 className="text-xl font-bold text-navy">Заявка на сертификат</h3><p className="mt-1 text-xs text-foreground/55">Без оплаты на сайте</p></div></div>
      <fieldset className="mb-7"><legend className="text-sm font-semibold text-navy">На какую сумму?</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{amounts.map(value => <button key={value} type="button" aria-pressed={amount === String(value)} onClick={() => setAmount(String(value))} className={`rounded-xl border px-2 py-3 text-sm font-semibold transition ${amount === String(value) ? "border-navy bg-navy text-white" : "border-navy/15 text-navy hover:border-blue"}`}>{rubles(value)}</button>)}</div>
        <label className="mt-4 block text-sm text-foreground/65" htmlFor="gift-amount">Или своя сумма, ₽</label>
        <input id="gift-amount" name="amount" type="number" min="1" max="100000000" step="1" inputMode="numeric" placeholder="Можно обсудить с менеджером" value={amount} onChange={e => setAmount(e.target.value)} className={inputClass} />
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-navy" htmlFor="gift-name">Имя <span aria-hidden="true">*</span><input id="gift-name" name="name" required maxLength={255} autoComplete="given-name" placeholder="Как к вам обращаться" className={inputClass}/></label>
        <label className="block text-sm font-medium text-navy" htmlFor="gift-phone">Телефон <span aria-hidden="true">*</span><input id="gift-phone" name="phone" type="tel" required maxLength={30} minLength={10} autoComplete="tel" placeholder="+7 (___) ___-__-__" className={inputClass}/></label>
      </div>
      <label className="mt-5 block text-sm font-medium text-navy" htmlFor="gift-email">Email <span className="font-normal text-foreground/45">— необязательно</span><input id="gift-email" name="email" type="email" maxLength={254} autoComplete="email" placeholder="you@example.ru" className={inputClass}/></label>
      <label className="mt-5 block text-sm font-medium text-navy" htmlFor="gift-comment">Комментарий<textarea id="gift-comment" name="comment" maxLength={3000} rows={3} placeholder="Для кого подарок, к какой дате он нужен и как с вами удобнее связаться" className={`${inputClass} resize-y`} /></label>
      <p className="mt-2 text-xs leading-relaxed text-foreground/50">Не указывайте паспортные данные и личные данные получателя подарка.</p>
      <fieldset className="mt-6 space-y-4 border-t border-navy/10 pt-5">
        <legend className="sr-only">Согласия</legend>
        <label className="flex items-start gap-3 text-xs leading-relaxed text-foreground/75"><input name="personal_data" type="checkbox" required defaultChecked className="mt-0.5 size-4 shrink-0 accent-[#0f2c5c]"/><span>Даю ИП Севрюге Елене Александровне <a href="/gift-certificates/personal-data" target="_blank" rel="noopener noreferrer" className="font-medium text-blue underline underline-offset-2">согласие на обработку персональных данных</a> и <a href="/gift-certificates/communication" target="_blank" rel="noopener noreferrer" className="font-medium text-blue underline underline-offset-2">связь по заявке</a> по телефону, email и в мессенджерах.</span></label>
        <label className="flex items-start gap-3 text-xs leading-relaxed text-foreground/75"><input name="marketing" type="checkbox" defaultChecked className="mt-0.5 size-4 shrink-0 accent-[#0f2c5c]"/><span>Даю <a href="/gift-certificates/marketing" target="_blank" rel="noopener noreferrer" className="font-medium text-blue underline underline-offset-2">согласие на информационные и рекламные рассылки</a> по email, телефону и в мессенджерах.</span></label>
      </fieldset>
      <div aria-live="polite">{status === "error" && <div role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700"><p>Заявка не отправлена. {Object.keys(errors).length ? "Проверьте данные:" : "Попробуйте ещё раз или позвоните +7 (950) 230-25-55."}</p>{Object.entries(errors).map(([key, values]) => <p key={key} className="mt-1">{Array.isArray(values) ? values.join(" ") : String(values)}</p>)}</div>}</div>
      <button type="submit" disabled={status === "pending"} className="mt-7 flex w-full items-center justify-center gap-3 rounded-full bg-navy px-5 py-4 font-semibold text-white transition hover:bg-blue disabled:cursor-wait disabled:opacity-60">{status === "pending" ? <><LoaderCircle size={18} className="animate-spin"/>Отправляем…</> : <>Оставить заявку на сертификат <ArrowRight size={18}/></>}</button>
      <p className="mt-4 text-center text-xs leading-relaxed text-foreground/50">Заявка ни к чему не обязывает. Условия сертификата согласуем до оплаты.</p>
    </form>
  );
}
