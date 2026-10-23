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

export const metadata: Metadata = {
  title: { absolute: 'TravelPal - Todos tus planes, un solo viaje' },
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  description: 'Organiza itinerarios, reservas, gastos y recuerdos en un solo lugar. Dale forma a tu próximo viaje con TravelPal.',
};

export default function Home() {
  return (
    <div className={styles.landing}>
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
