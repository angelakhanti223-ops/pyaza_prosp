import Hero from "@/components/home/Hero";
import Advantages from "@/components/home/Advantages";
import StatsBand from "@/components/home/StatsBand";
import WhyUs from "@/components/home/WhyUs";
import ConnectSection from "@/components/home/ConnectSection";
import BookingSteps from "@/components/home/BookingSteps";
import SupportStages from "@/components/home/SupportStages";
import NewsletterCTA from "@/components/home/NewsletterCTA";

export default function Home() {
  return (
    <>
      <Hero />
      <Advantages />
      <StatsBand />
      <WhyUs />
      <ConnectSection />
      <BookingSteps />
      <SupportStages />
      <NewsletterCTA />
    </>
  );
}
