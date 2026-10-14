import Link from 'next/link'
import { accentLinkClassName } from '@/components/ui/actionStyles'

export default function CTA() {
  return (
    <section className="flex flex-col justify-between gap-6 border-t border-line px-5 py-12 sm:flex-row sm:items-center sm:px-12">
      <h2 className="text-3xl font-semibold tracking-tight">Empieza por tu próximo destino.</h2>
      <Link href="/signup" className={`${accentLinkClassName} min-h-12 shrink-0 self-start px-6 sm:self-auto`}>Crear mi cuenta</Link>
    </section>
  )
}
