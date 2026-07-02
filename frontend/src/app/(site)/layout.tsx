import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { LeadFormProvider } from "@/components/lead-form/LeadFormContext";
import LeadFormModal from "@/components/lead-form/LeadFormModal";
import ChatWidget from "@/components/chat-widget/ChatWidget";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <LeadFormProvider>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <LeadFormModal />
      <ChatWidget />
    </LeadFormProvider>
  );
}
