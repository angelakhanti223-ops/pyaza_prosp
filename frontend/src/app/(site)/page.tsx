import Hero from "@/components/home/Hero";
import Advantages from "@/components/home/Advantages";
import StatsBand from "@/components/home/StatsBand";
import WhyUs from "@/components/home/WhyUs";
import ConnectSection from "@/components/home/ConnectSection";
import BookingSteps from "@/components/home/BookingSteps";
import SupportStages from "@/components/home/SupportStages";
import Faq from "@/components/home/Faq";
import NewsletterCTA from "@/components/home/NewsletterCTA";
import { fetchSiteImages } from "@/lib/siteImagesApi";

export default async function Home() {
  const siteImages = await fetchSiteImages();

  return (
    <>
      <Hero image={siteImages.hero_background} />
      <Advantages />
      <StatsBand />
      <WhyUs images={siteImages} />
      <ConnectSection officeImage={siteImages.office_photo} />
      <BookingSteps />
      <SupportStages />
      <Faq />
      <NewsletterCTA />
    </>
  );
}
