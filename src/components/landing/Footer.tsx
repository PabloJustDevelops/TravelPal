import Link from 'next/link'
import Brand from './Brand'
import CurrentYear from './CurrentYear'
import styles from './landing.module.css'

export default function Footer() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto max-w-[1600px] px-5 py-12 sm:px-12">
        <div className="grid gap-8 sm:grid-cols-[2fr_1fr_1fr] sm:gap-12">
          <div>
            <Brand />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              Un lugar para organizar tus viajes y conservar lo que viviste.
            </p>
          </div>
          <nav aria-label="Producto">
            <h2 className="mb-2 text-sm font-semibold">Producto</h2>
            <ul>
              <li><Link href="/signin" className={styles.footerLink}>Iniciar sesión</Link></li>
              <li><Link href="/signup" className={styles.footerLink}>Crear cuenta</Link></li>
            </ul>
          </nav>
          <nav aria-label="Proyecto">
            <h2 className="mb-2 text-sm font-semibold">Proyecto</h2>
            <ul>
              <li><a href="https://github.com/PabloJustDevelops/TravelPal" className={styles.footerLink}>Repositorio en GitHub</a></li>
              <li><a href="https://github.com/PabloJustDevelops/TravelPal/blob/main/LICENSE" className={styles.footerLink}>Licencia MIT</a></li>
            </ul>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 text-xs leading-relaxed text-muted sm:flex-row sm:justify-between">
          <p>© <CurrentYear /> TravelPal. Código bajo licencia MIT.</p>
          <p>Ilustraciones originales creadas con IA.</p>
        </div>
      </div>
    </footer>
  )
}
