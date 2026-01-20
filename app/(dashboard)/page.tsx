import {
  Nav,
  Hero,
  ProblemSection,
  SolutionSection,
  PricingSection,
  FinalCTA,
  FAQSection,
  Footer,
} from '@/components/landing';
import { AuthProvider } from '@/components/auth/auth-provider';

export default function HomePage() {
  return (
    <AuthProvider>
      <Nav />
      <main>
        <Hero />
        <ProblemSection />
        <SolutionSection />
        <PricingSection />
        <FAQSection />
        <FinalCTA />
      </main>
      <Footer />
    </AuthProvider>
  );
}
