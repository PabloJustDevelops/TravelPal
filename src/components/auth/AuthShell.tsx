import type { ReactNode } from 'react'
import Image from 'next/image'
import Brand from '@/components/landing/Brand'

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-2">
        <section className="flex flex-col px-5 py-6 sm:px-10 lg:px-16 lg:py-10">
          <Brand />
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10 lg:py-12">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.16em] text-accent">Tu espacio de viaje</p>
            {children}
          </div>
          <p className="text-xs text-muted">© {new Date().getFullYear()} TravelPal · Viajes con todo en su sitio.</p>
        </section>
        <aside className="m-5 mt-0 overflow-hidden rounded-3xl bg-surface lg:m-5 lg:ml-0 lg:flex lg:flex-col lg:justify-center">
          <div className="px-6 pt-8 sm:px-10 lg:pt-12">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Menos pestañas. Más camino.</p>
            <h2 className="mt-4 max-w-lg text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Tu próximo viaje empieza aquí.</h2>
            <p className="mt-4 max-w-md leading-relaxed text-muted">El itinerario, las reservas y el presupuesto, juntos. Deja espacio para lo que te encuentres por el camino.</p>
          </div>
          <Image
            src="/images/atlas/coastal-journey.webp"
            alt="Ilustración de un viajero recorriendo un pueblo junto a la costa mediterránea"
            width={1536}
            height={1024}
            sizes="(min-width: 1024px) 50vw, 100vw"
            loading="eager"
            className="mt-8 h-auto w-full"
          />
          <p className="px-6 py-4 text-xs text-muted sm:px-10">Ilustración original creada para TravelPal con IA.</p>
        </aside>
      </div>
    </main>
  )
}
