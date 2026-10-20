import { Skeleton, SkeletonCard, SkeletonText, SKELETON_TEST_IDS } from './Skeleton'
import nextTripStyles from '@/components/dashboard/nextTrip.module.css'

export type InteriorScreen = 'dashboard' | 'trips' | 'trip' | 'create-trip' | 'planning' | 'tasks' | 'expenses' | 'expenses/new' | 'expense-edit' | 'notes' | 'profile' | 'settings'
const labels: Record<InteriorScreen, string> = { dashboard: 'dashboard', trips: 'viajes', trip: 'viaje', 'create-trip': 'nuevo viaje', planning: 'planificación', tasks: 'tareas', expenses: 'gastos', 'expenses/new': 'nuevo gasto', 'expense-edit': 'gasto', notes: 'notas', profile: 'perfil', settings: 'ajustes' }

type Props = { screen: InteriorScreen; visible?: boolean; view?: string }

function Rows({ count = 3 }: { count?: number }) {
  return <div className="divide-y divide-line">{Array.from({ length: count }, (_, i) => <div key={i} className="space-y-3 py-5"><Skeleton className="h-6 w-1/2" /><SkeletonText lines={2} /></div>)}</div>
}
function Fields() {
  return <div className="max-w-3xl space-y-6">{Array.from({ length: 4 }, (_, i) => <div key={i} className="space-y-2"><Skeleton className="w-28" /><Skeleton className="h-11 w-full" /></div>)}</div>
}

/** Formas de la composición real; nunca contienen datos de ejemplo. */
export default function InteriorSkeleton({ screen, visible = true, view }: Props) {
  return (
    <div role="status" aria-label={`Cargando ${labels[screen]}`} aria-busy="true">
      <span className="sr-only">Cargando contenido</span>
      <div data-testid={visible ? SKELETON_TEST_IDS.page : undefined} data-screen={screen} aria-hidden="true" className={`space-y-6 ${visible ? '' : 'invisible'}`}>
        <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full max-w-xl space-y-2"><Skeleton className="h-8 w-2/3 sm:h-[44px]" /><Skeleton className="h-6 w-full sm:h-7" /></div>
          <Skeleton className="h-11 w-32 shrink-0" />
        </div>
        {screen === 'dashboard' ? <>
          <div className={nextTripStyles.overview}>
            <div className={nextTripStyles.hero}><Skeleton className="h-3 w-40" /><Skeleton className="mt-4 h-10 w-2/3" /><SkeletonText lines={2} className="mt-4 max-w-xl" /><Skeleton className="mt-6 h-12 w-48" /></div>
            <div className="grid grid-cols-1 border-t border-line lg:grid-cols-[minmax(0,1.4fr)_minmax(17rem,1fr)]"><div className="py-5 lg:pr-8"><Skeleton className="h-7 w-48" /><Rows count={2} /></div><div className="space-y-6 py-5 lg:border-l lg:border-line lg:pl-8"><SkeletonText lines={3} /><Skeleton className="h-7 w-40" /><SkeletonText lines={2} /><Skeleton className="h-2 w-full" /></div></div>
          </div>
          <SkeletonCard className="h-[86px]" ><Skeleton className="h-7 w-2/3" /></SkeletonCard>
        </> : screen === 'trips' ? <>
          <SkeletonCard className="flex min-h-[104px] items-center gap-4"><Skeleton className="h-11 flex-1" /><Skeleton className="h-11 w-1/3" /></SkeletonCard>
          <SkeletonCard className="flex min-h-72 flex-col justify-center sm:p-8 lg:p-10"><Skeleton className="w-24" /><Skeleton className="h-10 w-2/3" /><SkeletonText lines={2} /><Skeleton className="h-11 w-32" /></SkeletonCard><Rows count={2} />
        </> : screen === 'planning' ? <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)] lg:gap-6">
          {view === 'bookings' ? <Rows /> : view === 'itinerary' ? <div className="space-y-6"><Skeleton className="h-11 w-full" /><Rows /></div> : <SkeletonCard><Skeleton className="h-11 w-1/2" /><div className="grid grid-cols-7 gap-2">{Array.from({ length: 35 }, (_, i) => <Skeleton key={i} className="h-12 sm:h-16" />)}</div></SkeletonCard>}
          <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>
        </div> : screen === 'tasks' ? <>
          <div className="flex flex-wrap gap-4"><Skeleton className="h-11 w-64" /><Skeleton className="h-11 w-64" /></div>
          <div className={view === 'board' ? 'grid gap-6 md:grid-cols-3' : 'divide-y divide-line border-t border-line'}>{Array.from({ length: 3 }, (_, i) => <div key={i} className="space-y-4 py-4"><Skeleton className="h-11 w-40" />{(view === 'board' || i < 2) && <SkeletonCard><SkeletonText lines={2} /><Skeleton className="h-11 w-32" /></SkeletonCard>}</div>)}</div>
        </> : screen === 'expenses' ? <div className="grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]"><div><Skeleton className="h-8 w-48" /><Skeleton className="mt-6 h-11 w-full" /><Rows /></div><div className="space-y-5 xl:border-l xl:border-line xl:pl-7"><Skeleton className="h-7 w-40" /><SkeletonCard><Skeleton className="h-10 w-36" /><SkeletonText lines={2} /><Skeleton className="h-2" /></SkeletonCard><SkeletonCard /></div></div>
        : screen === 'notes' ? <>
          <div className="flex flex-col gap-4 border-b border-line pb-6 lg:flex-row"><Skeleton className="h-11 flex-1" /><Skeleton className="h-11 lg:w-48" /><Skeleton className="h-11 lg:w-48" /></div>
          <div className="grid rounded-lg border border-line lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]"><div className="p-4 lg:border-r lg:border-line"><Skeleton className="h-11 w-48" /><Rows /></div><div className="hidden space-y-6 p-6 lg:block"><Skeleton className="h-8 w-2/3" /><SkeletonText lines={6} /></div></div>
        </> : screen === 'profile' ? <div className="space-y-7"><Skeleton className="h-11 w-64" /><Skeleton className="h-7 w-44" /><div className="flex gap-6"><Skeleton className="h-24 w-24 shrink-0 rounded-full" /><SkeletonText lines={2} className="w-1/2 self-center" /></div><Fields /></div>
        : screen === 'settings' ? <div className="space-y-8"><Skeleton className="h-11 w-64" /><Skeleton className="h-8 w-40" /><div className="grid max-w-3xl gap-4 sm:grid-cols-3">{[0, 1, 2].map(i => <SkeletonCard key={i} className="min-h-48" />)}</div><SkeletonCard /><SkeletonCard /></div>
        : <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]"><Fields /><SkeletonCard className="self-start min-h-64" /></div>}
      </div>
    </div>
  )
}
