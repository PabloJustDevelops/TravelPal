'use client'

import { useRef, useState } from 'react'
import { PaperAirplaneIcon, MapPinIcon, HomeModernIcon } from '@heroicons/react/24/outline'
import styles from './landing.module.css'
import Button from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n/LocaleProvider'

export default function ExampleJourney() {
  const { t } = useI18n()
  const stops = [
    { title: t('arrival'), summary: t('arrivalSummary'), icon: PaperAirplaneIcon, detailTitle: t('arrivalTitle'), detail: t('arrivalDetail') },
    { title: t('townWalk'), summary: t('townSummary'), icon: MapPinIcon, detailTitle: t('townTitle'), detail: t('townDetail') },
    { title: t('lodging'), summary: t('lodgingSummary'), icon: HomeModernIcon, detailTitle: t('lodgingTitle'), detail: t('lodgingDetail') },
  ]
  const [selected, setSelected] = useState(0)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const active = stops[selected]

  return (
    <section id="example" aria-label={`${t('exampleJourney')}: ${t('coast')}`} className={styles.example}>
      <div className={styles.route}>
        <div className={styles.destination}>
          <p>{t('exampleJourney')}</p>
          <h2>{t('coast')}</h2>
        </div>
        <div role="tablist" aria-label={t('exampleStops')} className={styles.stops}>
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
