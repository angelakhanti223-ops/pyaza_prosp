"use client";

import { useEffect, useState } from "react";
import { ApiError, createLead, fetchDirections, type Direction } from "@/lib/api";
import LeadConsentFields from "./LeadConsentFields";
import { EMPTY_LEAD_CONSENTS, LEAD_CONSENT_VERSION } from "@/lib/leadConsents";

type Props = {
  onSuccess?: () => void;
  initialComment?: string;
};

export default function LeadForm({ onSuccess, initialComment }: Props) {
  const [directions, setDirections] = useState<Direction[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [directionId, setDirectionId] = useState("");
  const [comment, setComment] = useState(initialComment ?? "");
  const [consents, setConsents] = useState({ ...EMPTY_LEAD_CONSENTS });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchDirections().then(setDirections);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrors({});
    try {
      await createLead({
        name,
        phone,
        email: email || undefined,
        direction: directionId ? Number(directionId) : null,
        initial_comment: comment || undefined,
        consent: consents.personalData,
        consent_marketing: consents.marketing,
        consent_version: LEAD_CONSENT_VERSION,
      });
      setStatus("success");
      onSuccess?.();
    } catch (err) {
      setStatus("error");
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
      }
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl bg-blue-light p-8 text-center">
        <p className="text-lg font-semibold text-navy">Заявка отправлена!</p>
        <p className="mt-2 text-sm text-foreground/70">
          Спасибо, {name}. Наш менеджер свяжется с вами в ближайшее время.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <input
          required
          type="text"
          placeholder="Ваше имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue"
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name[0]}</p>}
      </div>
      <div>
        <input
          required
          type="tel"
          placeholder="Телефон"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue"
        />
        {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone[0]}</p>}
      </div>
      <div>
        <input
          type="email"
          placeholder="Email (необязательно)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue"
        />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email[0]}</p>}
      </div>
      <div>
        <select
          value={directionId}
          onChange={(e) => setDirectionId(e.target.value)}
          className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue"
        >
          <option value="">Направление / тип тура</option>
          {directions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <textarea
          placeholder="Комментарий (необязательно)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-blue"
        />
      </div>
      <LeadConsentFields value={consents} onChange={setConsents} errors={errors} />
      {status === "error" && !Object.keys(errors).length && (
        <p className="text-sm text-red-600">
          Не удалось отправить заявку. Попробуйте ещё раз.
        </p>
      )}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue disabled:opacity-60"
      >
        {status === "submitting" ? "Отправляем…" : "Отправить заявку"}
      </button>
    </form>
  );
}
