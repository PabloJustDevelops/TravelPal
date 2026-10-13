'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { CheckIcon } from '@heroicons/react/20/solid';
import { accentLinkClassName } from '@/components/ui/actionStyles';

const benefits = ['Itinerario', 'Reservas', 'Presupuesto'];

export default function Hero() {
  return (
    <section className="bg-background pt-20" aria-labelledby="home-heading">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-12 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:px-8 lg:py-20">
        <motion.div
          className="max-w-xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">
            Todo tu viaje, en un solo lugar
          </p>
          <h1 id="home-heading" className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Planifica tu próxima aventura
          </h1>
          <p className="mt-5 max-w-prose text-lg leading-reading text-muted">
            Organiza el itinerario, las reservas y el presupuesto para disfrutar cada destino con menos estrés.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/signup" className={accentLinkClassName}>
              Crear mi viaje
            </Link>
            <Link href="#features" className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-ink hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              Descubrir TravelPal <span className="ml-2" aria-hidden="true">→</span>
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted" aria-label="Incluye">
            {benefits.map((benefit) => (
              <li key={benefit} className="inline-flex items-center gap-1.5">
                <CheckIcon className="h-4 w-4 text-success" aria-hidden="true" />
                {benefit}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          className="relative min-h-[280px] overflow-hidden rounded-2xl bg-surface sm:min-h-[400px] lg:min-h-[500px]"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.1 }}
        >
          <Image
            src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=85"
            alt="Paisaje de montaña junto a un lago"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="object-cover"
          />
          <div className="absolute inset-x-4 bottom-4 rounded-xl border border-line bg-paper p-4 shadow-lg backdrop-blur sm:inset-x-6 sm:bottom-6 sm:max-w-xs">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Tu próxima escapada</p>
            <p className="mt-1 text-lg font-semibold text-ink">A un plan de distancia</p>
            <p className="mt-1 text-sm text-muted">Guarda los detalles y compártelos con tu grupo.</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
