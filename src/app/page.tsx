import { Metadata } from 'next';
import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import ExampleJourney from '@/components/landing/ExampleJourney';
import Features from '@/components/landing/Features';
import HowItWorks from '@/components/landing/HowItWorks';
import CTA from '@/components/landing/CTA';
import Footer from '@/components/landing/Footer';

export const metadata: Metadata = {
  title: 'TravelPal - Todos tus planes, un solo viaje',
  description: 'Organiza itinerarios, reservas, gastos y recuerdos en un solo lugar. Dale forma a tu próximo viaje con TravelPal.',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-ink">
      <Navbar />
      <Hero />
      <ExampleJourney />
      <Features />
      <HowItWorks />
      <CTA />
      <Footer />
    </main>
  );
}
