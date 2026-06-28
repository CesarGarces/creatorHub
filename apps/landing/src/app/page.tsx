import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ToolsSection } from "@/components/landing/tools-section";
import { AgentsSection } from "@/components/landing/agents-section";
import { ThumbnailShowcase } from "@/components/landing/thumbnail-showcase";
import { Pricing } from "@/components/landing/pricing";
import { FAQ } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <ToolsSection />
        <AgentsSection />
        <ThumbnailShowcase />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
