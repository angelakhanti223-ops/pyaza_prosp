import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { LeadFormProvider } from "@/components/lead-form/LeadFormContext";
import LeadFormModal from "@/components/lead-form/LeadFormModal";
import ChatWidget from "@/components/chat-widget/ChatWidget";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  name: "Слетать.ру",
  url: SITE_URL,
  telephone: "+7-950-230-25-55",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Пр-т Строителей, 49А, ТЦ «Проспект»",
    addressLocality: "Пенза",
    addressCountry: "RU",
  },
  sameAs: ["https://t.me/sletat_ru_pnz", "https://vk.com/sletat_ru_pnz"],
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <LeadFormProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <LeadFormModal />
      <ChatWidget />
    </LeadFormProvider>
  );
}
