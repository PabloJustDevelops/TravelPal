import { Metadata } from 'next';
import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import ExampleJourney from '@/components/landing/ExampleJourney';
import Features from '@/components/landing/Features';
import HowItWorks from '@/components/landing/HowItWorks';
import CTA from '@/components/landing/CTA';
import Footer from '@/components/landing/Footer';
import LandingMotion from '@/components/landing/LandingMotion';
import styles from '@/components/landing/landing.module.css';
import LocaleBootstrap from '@/lib/i18n/LocaleBootstrap'

export const metadata: Metadata = {
  title: { absolute: 'TravelPal - Todos tus planes, un solo viaje' },
  robots: { index: false, follow: true },
  alternates: { canonical: '/es' },
  description: 'Organiza itinerarios, reservas, gastos y recuerdos en un solo lugar. Dale forma a tu próximo viaje con TravelPal.',
};

export default function Home() {
  return (
    <div className={styles.landing}>
      <LocaleBootstrap />
      <main className="min-h-screen bg-background text-ink">
        <Navbar />
        <Hero />
        <LandingMotion>
          <ExampleJourney />
          <Features />
          <HowItWorks />
          <CTA />
        </LandingMotion>
      </main>
      <Footer />
    </div>
  );
}
