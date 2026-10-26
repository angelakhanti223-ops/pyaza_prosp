"use client";

import { LEAD_CONSENT_COPY, LEAD_CONSENT_LINKS, type LeadConsentsValue } from "@/lib/leadConsents";

type Props = {
  value: LeadConsentsValue;
  onChange: (value: LeadConsentsValue) => void;
  errors?: Record<string, string[]>;
};

export default function LeadConsentFields({ value, onChange, errors = {} }: Props) {
  return (
    <div className="flex flex-col gap-3 text-xs leading-relaxed text-foreground/70">
      <label className="flex items-start gap-2">
        <input type="checkbox" name="consent" required checked={value.personalData}
          onChange={e => onChange({ ...value, personalData: e.target.checked })}
          className="mt-0.5 shrink-0 accent-blue" />
        <span>{LEAD_CONSENT_COPY.personalData}. <span className="text-navy">Обязательно.</span>{" "}
          <a href={LEAD_CONSENT_LINKS.personalData} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-blue">Текст согласия</a>
        </span>
      </label>
      {errors.consent && <p role="alert" className="text-red-600">{errors.consent.join(" ")}</p>}
      <label className="flex items-start gap-2">
        <input type="checkbox" name="consent_marketing" checked={value.marketing}
          onChange={e => onChange({ ...value, marketing: e.target.checked })}
          className="mt-0.5 shrink-0 accent-blue" />
        <span>{LEAD_CONSENT_COPY.marketing}. Необязательно.{" "}
          <a href={LEAD_CONSENT_LINKS.marketing} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-blue">Условия рассылки</a>
        </span>
      </label>
      {errors.consent_marketing && <p role="alert" className="text-red-600">{errors.consent_marketing.join(" ")}</p>}
      {errors.consent_version && <p role="alert" className="text-red-600">Обновите страницу, чтобы прочитать актуальные тексты согласий.</p>}
    </div>
  );
}
