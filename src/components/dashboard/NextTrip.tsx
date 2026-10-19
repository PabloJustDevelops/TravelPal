import styles from './nextTrip.module.css';
import Link from 'next/link';
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import type { Expense, ItineraryActivity, Task, Trip } from '@/lib/insforge';
import { accentLinkClassName } from '@/components/ui/actionStyles';
import { formatCurrency } from '@/lib/utils';

interface DashboardBudget {
  id: string;
  trip_id?: string;
  name: string;
  category: string;
  total_amount: number;
  spent_amount: number;
  start_date: string;
  end_date: string;
  currency: string;
}

export type DashboardActivity = Pick<
  ItineraryActivity,
  'id' | 'trip_id' | 'date' | 'title' | 'description' | 'start_time' | 'location' | 'completed'
>;

export type DashboardTask = Pick<Task, 'id' | 'title' | 'status' | 'due_date'>;
export type DashboardExpense = Pick<Expense, 'id' | 'trip_id' | 'date' | 'amount' | 'currency' | 'category'>;

interface NextTripProps {
  trips: Trip[];
  today?: string;
  activities?: DashboardActivity[];
  tasks?: DashboardTask[];
  budgets?: DashboardBudget[];
  expenses?: DashboardExpense[];
}

function getBudgetSpent(budget: DashboardBudget, expenses: DashboardExpense[]) {
  const start = new Date(budget.start_date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(budget.end_date);
  end.setHours(23, 59, 59, 999);

  return expenses.reduce((spent, expense) => {
    const expenseDate = new Date(expense.date);
    const dateInRange = expenseDate >= start && expenseDate <= end;
    const categoryMatch = budget.category === 'travel' || expense.category === budget.category;
    const tripMatch = !budget.trip_id || expense.trip_id === budget.trip_id;
    const currencyMatch = expense.currency === budget.currency;

    return dateInRange && categoryMatch && tripMatch && currencyMatch
      ? spent + expense.amount
      : spent;
  }, 0);
}

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

export function localToday() {
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

function formatActivityDate(value: string) {
  const date = new Date(`${localDay(value)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'Fecha por confirmar';
  return new Intl.DateTimeFormat('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function formatDueDate(value: string) {
  return formatActivityDate(value);
}

function formatActivityTime(value?: string) {
  return value?.slice(0, 5);
}

export default function NextTrip({
  trips,
  today = localToday(),
  activities = [],
  tasks = [],
  budgets = [],
  expenses = [],
}: NextTripProps) {
  const trip = selectNextTrip(trips, today);
  const tripActivities = trip
    ? activities.filter((activity) => activity.trip_id === trip.id)
    : [];
  const pendingTasks = tasks.filter((task) => task.status !== 'completed');
  const tripBudgets = trip
    ? budgets.filter((budget) => budget.trip_id === trip.id)
    : [];

  return (
    <div className={styles.overview}>
      <section aria-labelledby="next-trip-title" className={styles.hero}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{trip && localDay(trip.departure_date) < today ? 'Tu viaje en curso' : 'Tu próxima aventura'}</p>
        <div className="mt-4 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-2xl">
            <h2 id="next-trip-title" className="break-words text-3xl font-bold tracking-tight text-ink sm:text-4xl">{trip ? trip.title : 'El próximo viaje empieza aquí'}</h2>
            {trip ? (
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
                <p className="flex items-center gap-2"><MapPinIcon className="h-5 w-5 shrink-0" aria-hidden="true" />{trip.origin} → {trip.destination}</p>
                <p className="flex items-start gap-2"><CalendarIcon className="h-5 w-5 shrink-0" aria-hidden="true" /><span>{formatDate(trip.departure_date)}{trip.return_date ? ` — ${formatDate(trip.return_date)}` : ''}</span></p>
              </div>
            ) : <p className="mt-3 leading-relaxed text-muted">Elige un destino y reúne tus fechas, planes y reservas en un solo lugar.</p>}
          </div>
          <Link href={trip ? `/trip?id=${encodeURIComponent(trip.id)}` : '/trips'} className={`${accentLinkClassName} min-h-12 shrink-0 gap-3 self-start xl:self-auto`}>
            {trip ? 'Continuar planificación' : 'Organizar un viaje'}<ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
        {trip && localDay(trip.departure_date) >= today && <p className="mt-5 text-sm font-medium text-ink">{(() => {
          const days = Math.round((Date.parse(`${localDay(trip.departure_date)}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
          return days === 0 ? 'Sales hoy' : days === 1 ? 'Falta 1 día' : `Faltan ${days} días`;
        })()}</p>}
      </section>

      <div className="grid grid-cols-1 border-t border-line lg:grid-cols-[minmax(0,1.4fr)_minmax(17rem,1fr)]">
        <section aria-labelledby="dashboard-itinerary-title" className="min-w-0 self-start py-5 lg:pr-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 pb-2">
            <h3 id="dashboard-itinerary-title" className="font-sans text-xl font-bold tracking-tight text-ink">Los primeros planes</h3>
            {trip && <Link href={`/trip?id=${encodeURIComponent(trip.id)}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              Ver itinerario completo<ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>}
          </div>
          {!trip ? (
            <p className="py-2 text-sm text-muted">Tu itinerario aparecerá cuando tengas un viaje próximo.</p>
          ) : tripActivities.length > 0 ? (
            <ol className="divide-y divide-line">
              {tripActivities.map((activity) => (
                <li key={activity.id} className="flex gap-4 py-4 first:pt-2 last:pb-2">
                  <div className="w-20 shrink-0 pt-0.5 text-xs font-medium capitalize text-muted">
                    <time dateTime={activity.date}>{formatActivityDate(activity.date)}</time>
                    {formatActivityTime(activity.start_time) && <span className="mt-1 block text-ink">{formatActivityTime(activity.start_time)}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{activity.title}</p>
                    {activity.description && <p className="mt-1 text-sm leading-5 text-muted">{activity.description}</p>}
                    {activity.location && <p className="mt-1 flex items-center gap-1 text-xs text-muted"><MapPinIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{activity.location}</p>}
                  </div>
                  {activity.completed && <span className="shrink-0"><CheckCircleIcon className="h-5 w-5 text-success" aria-hidden="true" /><span className="sr-only">Actividad completada</span></span>}
                </li>
              ))}
            </ol>
          ) : (
            <div className="py-6">
              <p className="text-sm text-muted">Aún no hay actividades para este viaje.</p>
              <Link href={`/trip?id=${encodeURIComponent(trip.id)}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                Añadir actividades
              </Link>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 lg:border-l lg:border-line lg:pl-8">
          <section aria-labelledby="dashboard-tasks-title" className="min-w-0 py-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 pb-2">
              <h3 id="dashboard-tasks-title" className="font-sans text-xl font-bold tracking-tight text-ink">Antes de salir</h3>
              <Link href="/tasks" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                Ver tareas<ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {pendingTasks.length > 0 ? (
              <ul className="divide-y divide-line">
                {pendingTasks.slice(0, 3).map((task) => (
                  <li key={task.id} className="flex gap-3 py-3 first:pt-2 last:pb-2">
                    <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-ink">{task.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {task.status === 'in_progress' ? 'En curso' : 'Pendiente'}
                        {task.due_date && ` · Vence ${formatDueDate(task.due_date)}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="py-5 text-sm text-muted">No tienes tareas pendientes.</p>}
          </section>

          <section aria-labelledby="dashboard-budget-title" className="min-w-0 py-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 pb-2">
              <h3 id="dashboard-budget-title" className="font-sans text-xl font-bold tracking-tight text-ink">Presupuesto del viaje</h3>
              <Link href="/expenses" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                Ver presupuestos<ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {!trip ? (
              <p className="py-5 text-sm text-muted">Vincula un presupuesto a un viaje próximo para verlo aquí.</p>
            ) : tripBudgets.length > 0 ? (
              <ul className="space-y-4">
                {tripBudgets.slice(0, 3).map((budget) => {
                  const spentAmount = getBudgetSpent(budget, expenses);
                  const progress = budget.total_amount > 0
                    ? Math.min(100, Math.max(0, (spentAmount / budget.total_amount) * 100))
                    : null;
                  return (
                    <li key={budget.id}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="min-w-0 break-words text-sm font-medium text-ink">{budget.name}</p>
                        <p className="shrink-0 text-sm font-semibold text-ink">
                          {formatCurrency(spentAmount, budget.currency)} <span className="font-normal text-muted">de {formatCurrency(budget.total_amount, budget.currency)}</span>
                        </p>
                      </div>
                      {progress !== null && <div className="mt-2 flex items-center gap-3">
                        <div
                          role="progressbar"
                          aria-label={`Uso del presupuesto ${budget.name}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(progress)}
                          className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-strong"
                        >
                          <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="w-10 shrink-0 text-right text-xs text-muted">{Math.round(progress)} %</span>
                      </div>}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="py-5 text-sm text-muted">Aún no hay presupuestos asociados a este viaje.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
