import Link from 'next/link'
import Image from 'next/image'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { accentLinkClassName } from '@/components/ui/actionStyles'
import styles from './landing.module.css'
import { cn } from '@/lib/utils'

export default function Hero() {
  return (
    <section aria-labelledby="home-heading" className={styles.hero}>
      <div className={styles.copy}>
        <h1 id="home-heading" className={styles.title}>
          <span>Tu viaje,</span>{' '}
          <span>de principio a fin.</span>
        </h1>
        <p className={styles.subtitle}>Itinerario, reservas y gastos. En un mismo lugar.</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
          <Link href="/signup" className={cn(accentLinkClassName, 'min-h-14 gap-3 px-6 text-lg')}>
            Crear mi viaje <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link href="#example" className="inline-flex min-h-12 items-center gap-3 rounded-sm text-lg font-medium text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            Ver un ejemplo <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className={styles.caption} aria-hidden="true">
        <span className={styles.captionTitle}>Costa mediterránea</span>
        <p>Un plan, muchos momentos<br />por descubrir.</p>
      </div>
      <Image
        src="/images/atlas/coastal-panorama.webp"
        alt="Ilustración de un viajero siguiendo un sendero hacia un pueblo costero, con montañas y un velero al fondo"
        width={1774}
        height={887}
        preload
        sizes="(max-width: 640px) 200vw, 100vw"
        className={styles.scene}
      />
    </section>
  )
}
