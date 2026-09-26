import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "База знаний ЮВА",
  robots: { index: false, follow: false },
};

export default function SeaKbLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl">{children}</div>;
}
