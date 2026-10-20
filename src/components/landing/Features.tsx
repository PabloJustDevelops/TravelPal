import LandingImage from './LandingImage'
import styles from './landing.module.css'

export default function Features() {
  return (
    <section id="features" className="grid overflow-hidden bg-surface lg:grid-cols-[1.1fr_1fr]">
      <div className="px-5 py-12 sm:px-12 lg:py-16">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Organiza cada detalle.</h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">Itinerarios, reservas, gastos, tareas, notas y diario de viaje.</p>
        <dl className="mt-8 max-w-xl divide-y divide-line">
          <div className="py-5"><dt className="font-semibold">Un lugar para tus planes</dt><dd className="mt-2 text-sm leading-relaxed text-muted">Consulta las actividades y reservas de cada viaje sin buscar entre notas sueltas.</dd></div>
          <div className="py-5"><dt className="font-semibold">Los gastos, al día</dt><dd className="mt-2 text-sm leading-relaxed text-muted">Registra lo que vas gastando y compáralo con el presupuesto del viaje.</dd></div>
          <div className="py-5"><dt className="font-semibold">Los recuerdos también cuentan</dt><dd className="mt-2 text-sm leading-relaxed text-muted">Escribe en el diario y guarda las fotos que quieras conservar al volver.</dd></div>
        </dl>
      </div>
      <LandingImage src="/images/atlas/coastal-journey.webp" alt="Detalle ilustrado del pueblo costero y el camino de un viajero" width={1536} height={1024} sizes="(min-width: 1024px) 50vw, 100vw" className={styles.featureImage} />
    </section>
  )
}
