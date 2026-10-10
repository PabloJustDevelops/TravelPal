import Link from 'next/link';
import { ArrowRightIcon, CalendarIcon, MapPinIcon } from '@heroicons/react/24/outline';
import type { Trip } from '@/lib/insforge';
import { accentLinkClassName } from '@/components/ui/actionStyles';

export function selectNextTrip(trips: Trip[], today: string) {
  const eligibleTrips = trips.filter(trip =>
    (trip.status === 'planned' || trip.status === 'confirmed') &&
    localDay(trip.return_date || trip.departure_date) >= today
  );

  return eligibleTrips.sort((a, b) => {
    const aIsCurrent = localDay(a.departure_date) < today;
    const bIsCurrent = localDay(b.departure_date) < today;
    if (aIsCurrent !== bIsCurrent) return aIsCurrent ? -1 : 1;
    return new Date(a.departure_date).getTime() - new Date(b.departure_date).getTime();
  })[0];
}

function localDay(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(value: string) {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(isDateOnly ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return 'Fecha por confirmar';
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(isDateOnly ? {} : { hour: 'numeric', minute: '2-digit' }),
  };
  return new Intl.DateTimeFormat('es', options).format(date);
}

export default function NextTrip({ trips, today = localToday() }: { trips: Trip[]; today?: string }) {
  const trip = selectNextTrip(trips, today);
  return (
    <section aria-labelledby="next-trip-title" className="rounded-xl border border-line bg-paper p-6 sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{trip && localDay(trip.departure_date) < today ? 'Tu viaje en curso' : 'Tu próxima aventura'}</p>
      <div className="mt-4 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 max-w-2xl">
          <h2 id="next-trip-title" className="break-words text-3xl font-bold tracking-tight text-ink sm:text-4xl">{trip ? trip.title : 'El próximo viaje empieza aquí'}</h2>
          {trip ? (
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
              <p className="flex items-center gap-2"><MapPinIcon className="h-5 w-5 shrink-0" aria-hidden="true" />{trip.destination}</p>
              <p className="flex items-start gap-2"><CalendarIcon className="h-5 w-5 shrink-0" aria-hidden="true" /><span>{formatDate(trip.departure_date)}{trip.return_date ? ` — ${formatDate(trip.return_date)}` : ''}</span></p>
            </div>
          ) : <p className="mt-3 leading-relaxed text-muted">Elige un destino y reúne tus fechas, planes y reservas en un solo lugar.</p>}
        </div>
        <Link href={trip ? `/trips/${encodeURIComponent(trip.id)}` : '/trips'} className={`${accentLinkClassName} min-h-12 shrink-0 gap-3 self-start xl:self-auto`}>
          {trip ? 'Continuar planificación' : 'Organizar un viaje'}<ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
