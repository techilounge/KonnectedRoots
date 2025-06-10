
import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import CallToActionSection from '@/components/landing/CallToActionSection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <CallToActionSection />
    </>
  );
}
