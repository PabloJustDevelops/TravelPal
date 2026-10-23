import type { ReactNode } from 'react';
import Link from 'next/link';
import Brand from '@/components/landing/Brand';
import Footer from '@/components/landing/Footer';
import PageTitle from '@/components/ui/PageTitle';
import { legal, legalPending } from '@/lib/legal';

export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-5 sm:px-12">
        <Brand />
        <Link href="/" className="inline-flex min-h-11 items-center text-accent underline">Volver al inicio</Link>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-5 py-12 sm:px-12">
        <PageTitle title={title} subtitle={`Actualización: ${legal.FECHA_ACTUALIZACION}`} />
        {legalPending && (
          <div role="alert" className="rounded-lg border border-warning bg-surface p-5 text-ink">
            <p className="font-semibold">Información legal pendiente de completar</p>
            <p className="mt-2">Faltan datos de identificación, contacto y revisión. Los marcadores entre corchetes no son un canal válido para ejercer derechos. Este texto aún no es una información legal definitiva.</p>
          </div>
        )}
        <div className="space-y-8 text-base leading-relaxed [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_p+p]:mt-3 [&_a]:text-accent [&_a]:underline [&_li]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
        <nav aria-label="Información legal" className="flex flex-wrap gap-6 border-t border-line pt-6">
          <Link href="/aviso-legal" className="inline-flex min-h-11 items-center text-accent underline">Aviso legal</Link>
          <Link href="/privacidad" className="inline-flex min-h-11 items-center text-accent underline">Privacidad</Link>
        </nav>
      </main>
      <Footer />
    </div>
  );
}
