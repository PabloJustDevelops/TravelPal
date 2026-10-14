'use client'

import { useRef, useState } from 'react'
import { PaperAirplaneIcon, MapPinIcon, HomeModernIcon } from '@heroicons/react/24/outline'
import styles from './landing.module.css'
import Button from '@/components/ui/Button'

const stops = [
  { title: 'Llegada', summary: 'Traslado al alojamiento y primer paseo.', icon: PaperAirplaneIcon, detailTitle: 'El comienzo, organizado', detail: 'Reúne los detalles de transporte y las notas de llegada junto al itinerario.' },
  { title: 'Paseo por el pueblo', summary: 'Calles con encanto, vistas al mar.', icon: MapPinIcon, detailTitle: 'Cada día, con su recorrido', detail: 'Añade actividades al itinerario y consulta qué tienes previsto para cada día.' },
  { title: 'Alojamiento', summary: 'Noche en el centro histórico.', icon: HomeModernIcon, detailTitle: 'La reserva, localizada', detail: 'Guarda el alojamiento y sus detalles dentro del viaje para encontrarlos cuando los necesites.' },
]

export default function ExampleJourney() {
  const [selected, setSelected] = useState(0)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const active = stops[selected]

  return (
    <section id="example" aria-label="Viaje de ejemplo: Costa mediterránea" className={styles.example}>
      <div className={styles.route}>
        <div className={styles.destination}>
          <p>Viaje de ejemplo</p>
          <h2>Costa mediterránea</h2>
        </div>
        <div role="tablist" aria-label="Paradas del viaje de ejemplo" className={styles.stops}>
          {stops.map((stop, index) => (
            <Button
              key={stop.title}
              ref={element => { tabs.current[index] = element }}
              id={`example-stop-${index}`}
              role="tab"
              type="button"
              aria-selected={selected === index}
              aria-controls="example-detail"
              tabIndex={selected === index ? 0 : -1}
              variant="ghost"
              className={`${styles.stop} h-auto justify-start rounded-none bg-transparent px-0 text-ink hover:bg-transparent`}
              onClick={() => setSelected(index)}
              onKeyDown={event => {
                let next = index
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % stops.length
                else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + stops.length - 1) % stops.length
                else if (event.key === 'Home') next = 0
                else if (event.key === 'End') next = stops.length - 1
                else return
                event.preventDefault()
                setSelected(next)
                tabs.current[next]?.focus()
              }}
            >
              <span className={styles.icon}><stop.icon className="h-5 w-5" aria-hidden="true" /></span>
              <span><strong>{stop.title}</strong><small>{stop.summary}</small></span>
            </Button>
          ))}
        </div>
      </div>
      <div key={selected} id="example-detail" role="tabpanel" aria-labelledby={`example-stop-${selected}`} tabIndex={0} className={styles.panel}>
        <strong>{active.detailTitle}</strong>
        <p>{active.detail}</p>
      </div>
    </section>
  )
}
