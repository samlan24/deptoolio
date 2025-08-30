import HeroSection from "./components/HeroSection";
import PainPointsSection from "./components/PainPointsSection";
import DesiredOutcomeSection from "./components/DesiredOutcomeSection";
import ProductIntroSection from "./components/ProductIntroSection";
import PricingSection from "./components/PricingSection";
import FinalCTASection from "./components/FinalCTASection";


const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <PainPointsSection />
      <DesiredOutcomeSection />
      <ProductIntroSection id="features" />
      <PricingSection id="pricing" />
      <FinalCTASection />
    </div>
  );
};

export default Index;