import Link from 'next/link'
import Brand from './Brand'

export default function Footer() {
  return <footer className="border-t border-line bg-paper"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between"><Brand /><p className="text-xs text-muted">© {new Date().getFullYear()} TravelPal. Ilustraciones originales creadas con IA.</p><nav aria-label="Acceso" className="flex gap-6 text-sm font-medium"><Link href="/signin" className="hover:text-accent">Iniciar sesión</Link><Link href="/signup" className="hover:text-accent">Crear cuenta</Link></nav></div></footer>
}
