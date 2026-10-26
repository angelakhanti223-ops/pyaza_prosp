import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CONSENT_DOCUMENTS, CONSENT_DOCUMENT_VERSION, CONSENT_OPERATOR } from "@/lib/leadConsents";

type Props = { params: Promise<{ kind: string }> };
function documentFor(kind: string) {
  return Object.hasOwn(CONSENT_DOCUMENTS, kind) ? CONSENT_DOCUMENTS[kind as keyof typeof CONSENT_DOCUMENTS] : null;
}
export function generateStaticParams() {
  return Object.keys(CONSENT_DOCUMENTS).map(kind => ({ kind }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kind } = await params;
  const document = documentFor(kind);
  return { title: `${document?.title ?? "Документ"} — Слетать.ру`, robots: { index: false, follow: true } };
}
export default async function ConsentPage({ params }: Props) {
  const { kind } = await params;
  const document = documentFor(kind);
  if (!document) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 pb-40 sm:px-6 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-blue">Слетать.ру · Офис ТЦ «Проспект», Пенза</p>
      <h1 className="mt-4 text-2xl font-bold leading-tight text-navy sm:text-3xl">{document.title}</h1>
      <p className="mt-3 text-xs text-foreground/50">Редакция от {CONSENT_DOCUMENT_VERSION.slice(0, 10).split("-").reverse().join(".")} · Версия {CONSENT_DOCUMENT_VERSION}</p>
      <p className="mt-5 text-sm font-semibold text-navy">{CONSENT_OPERATOR}</p>
      <div className="mt-7 space-y-5 text-sm leading-7 text-foreground/80">{document.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
      <p className="mt-10 rounded-2xl bg-blue-light p-5 text-sm leading-6 text-navy">Документ открыт для ознакомления. Само открытие страницы не означает согласия — выбор делается в форме заявки.</p>
    </article>
  );
}
