import siteConsents from "@/content/leadConsents.json";

// Public forms and the server validate this version of the linked documents.
export const LEAD_CONSENT_VERSION = siteConsents.version;
export const LEAD_CONSENT_LINKS = {
  personalData: "/consents/personal-data",
  marketing: "/consents/marketing",
} as const;
export type LeadConsentsValue = { personalData: boolean; marketing: boolean };
export const EMPTY_LEAD_CONSENTS: LeadConsentsValue = { personalData: false, marketing: false };
export const LEAD_CONSENT_COPY = {
  personalData: "Согласен на обработку персональных данных для подбора тура и связи по моей заявке",
  marketing: "Хочу получать рассылки с турами и предложениями",
} as const;
export const CONSENT_DOCUMENTS = siteConsents.documents;
export const CONSENT_OPERATOR = `${siteConsents.operator} · ИНН ${siteConsents.inn}`;
export const CONSENT_DOCUMENT_VERSION = siteConsents.version;
