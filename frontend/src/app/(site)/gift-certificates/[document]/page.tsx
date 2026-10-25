import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import consents from "@/content/giftConsents.json";

type DocumentKey = keyof typeof consents.documents;
export function generateStaticParams() { return Object.keys(consents.documents).map(document => ({ document })); }
export async function generateMetadata({ params }: { params: Promise<{ document: string }> }): Promise<Metadata> {
  const { document } = await params;
  const item = consents.documents[document as DocumentKey];
  return { title: item ? `${item.title} — Слетать.ру, Пенза` : "Документ не найден", robots: { index: false, follow: true } };
}
export default async function ConsentDocument({ params }: { params: Promise<{ document: string }> }) {
  const { document } = await params;
  const item = consents.documents[document as DocumentKey];
  if (!item) notFound();
  return <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
    <Link href="/gift-certificates#application" className="text-sm text-blue underline">← К заявке на сертификат</Link>
    <p className="mt-8 text-xs text-foreground/50">Редакция от 25 октября 2026 года • Версия {consents.version}</p>
    <h1 className="mt-3 text-3xl font-bold leading-tight text-navy sm:text-4xl">{item.title}</h1>
    <p className="mt-4 text-sm font-semibold text-navy">{consents.operator} • ИНН {consents.inn}</p>
    <div className="mt-8 space-y-5 text-sm leading-7 text-foreground/80">{item.paragraphs.map((p,i) => <p key={i}>{p}</p>)}</div>
  </article>;
}
