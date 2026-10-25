import slots from '@/components/ui/interiorSlots.module.css';
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
import { useI18n } from '@/lib/i18n/LocaleProvider';
import { formatDate, formatNumber, localePath } from '@/lib/i18n';

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

function formatTripDate(value: string, locale: 'es' | 'en', t: (key: import('@/lib/i18n').MessageKey) => string) {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(isDateOnly ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return t('dateToConfirm');
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(isDateOnly ? {} : { hour: 'numeric', minute: '2-digit' }),
  };
  return formatDate(date, locale, options);
}

function formatActivityDate(value: string, locale: 'es' | 'en') {
  const date = new Date(`${localDay(value)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'Fecha por confirmar';
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function formatDueDate(value: string, locale: 'es' | 'en') {
  return formatActivityDate(value, locale);
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
  const { locale, t } = useI18n();
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
      <section aria-labelledby="next-trip-title" data-loading-slot="dashboardHero" className={`${styles.hero} ${slots.dashboardHero}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{trip && localDay(trip.departure_date) < today ? t('currentTrip') : t('nextAdventure')}</p>
        <div className="mt-4 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-2xl">
            <h2 id="next-trip-title" className="break-words text-3xl font-bold tracking-tight text-ink sm:text-4xl">{trip ? trip.title : t('nextTripTitle')}</h2>
            {trip ? (
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
                <p className="flex items-center gap-2"><MapPinIcon className="h-5 w-5 shrink-0" aria-hidden="true" />{trip.origin} → {trip.destination}</p>
                <p className="flex items-start gap-2"><CalendarIcon className="h-5 w-5 shrink-0" aria-hidden="true" /><span>{formatTripDate(trip.departure_date, locale, t)}{trip.return_date ? ` — ${formatTripDate(trip.return_date, locale, t)}` : ''}</span></p>
              </div>
            ) : <p className="mt-3 leading-relaxed text-muted">{t('nextTripDescription')}</p>}
          </div>
          <Link href={trip ? `${(locale === 'en' ? localePath(locale, '/trip') : '/trip')}?id=${encodeURIComponent(trip.id)}` : (locale === 'en' ? localePath(locale, '/trips') : '/trips')} className={`${accentLinkClassName} min-h-12 shrink-0 gap-3 self-start xl:self-auto`}>
            {trip ? t('continuePlanning') : t('organizeTrip')}<ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
        {trip && localDay(trip.departure_date) >= today && <p className="mt-5 text-sm font-medium text-ink">{(() => {
          const days = Math.round((Date.parse(`${localDay(trip.departure_date)}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
          return days === 0 ? t('leavingToday') : days === 1 ? t('dayRemaining') : t('daysRemaining').replace('{count}', new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-ES').format(days));
        })()}</p>}
      </section>

      <div className="grid grid-cols-1 border-t border-line lg:grid-cols-[minmax(0,1.4fr)_minmax(17rem,1fr)]">
        <section tabIndex={0} aria-labelledby="dashboard-itinerary-title" data-loading-slot="dashboardItinerary" className={`${slots.dashboardItinerary} min-w-0 self-start py-5 lg:pr-8`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 pb-2">
            <h3 id="dashboard-itinerary-title" className="font-sans text-xl font-bold tracking-tight text-ink">{t('firstPlans')}</h3>
            {trip && <Link href={`${(locale === "en" ? localePath(locale, "/trip") : "/trip")}?id=${encodeURIComponent(trip.id)}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              {t('fullItinerary')}<ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>}
          </div>
          {!trip ? (
            <p className="py-2 text-sm text-muted">{t('itineraryWhenTrip')}</p>
          ) : tripActivities.length > 0 ? (
            <ol className="divide-y divide-line">
              {tripActivities.map((activity) => (
                <li key={activity.id} className="flex gap-4 py-4 first:pt-2 last:pb-2">
                  <div className="w-20 shrink-0 pt-0.5 text-xs font-medium capitalize text-muted">
                    <time dateTime={activity.date}>{formatActivityDate(activity.date, locale)}</time>
                    {formatActivityTime(activity.start_time) && <span className="mt-1 block text-ink">{formatActivityTime(activity.start_time)}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{activity.title}</p>
                    {activity.description && <p className="mt-1 text-sm leading-5 text-muted">{activity.description}</p>}
                    {activity.location && <p className="mt-1 flex items-center gap-1 text-xs text-muted"><MapPinIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{activity.location}</p>}
                  </div>
                  {activity.completed && <span className="shrink-0"><CheckCircleIcon className="h-5 w-5 text-success" aria-hidden="true" /><span className="sr-only">{t('activityCompleted')}</span></span>}
                </li>
              ))}
            </ol>
          ) : (
            <div className="py-6">
              <p className="text-sm text-muted">{t('noActivities')}</p>
              <Link href={`${(locale === "en" ? localePath(locale, "/trip") : "/trip")}?id=${encodeURIComponent(trip.id)}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                {t('addActivities')}
              </Link>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 lg:border-l lg:border-line lg:pl-8">
          <section tabIndex={0} aria-labelledby="dashboard-tasks-title" data-loading-slot="dashboardTasks" className={`${slots.dashboardTasks} min-w-0 py-5`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 pb-2">
              <h3 id="dashboard-tasks-title" className="font-sans text-xl font-bold tracking-tight text-ink">{t('beforeLeaving')}</h3>
              <Link href="/tasks" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                {t('viewTasks')}<ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
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
                        {task.status === 'in_progress' ? t('inProgress') : t('pending')}
                        {task.due_date && ` · ${t('due')} ${formatDueDate(task.due_date, locale)}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="py-5 text-sm text-muted">{t('noPendingTasks')}</p>}
          </section>

          <section tabIndex={0} aria-labelledby="dashboard-budget-title" data-loading-slot="dashboardBudget" className={`${slots.dashboardBudget} min-w-0 py-5`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 pb-2">
              <h3 id="dashboard-budget-title" className="font-sans text-xl font-bold tracking-tight text-ink">{t('tripBudget')}</h3>
              <Link href="/expenses" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                {t('viewBudgets')}<ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {!trip ? (
              <p className="py-5 text-sm text-muted">{t('linkBudget')}</p>
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
                          {formatCurrency(spentAmount, budget.currency, locale)} <span className="font-normal text-muted">{t('budgetOf').replace('{amount}', formatCurrency(budget.total_amount, budget.currency, locale))}</span>
                        </p>
                      </div>
                      {progress !== null && <div className="mt-2 flex items-center gap-3">
                        <div
                          role="progressbar"
                          aria-label={t('budgetUsage').replace('{name}', budget.name)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(progress)}
                          className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-strong"
                        >
                          <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="w-10 shrink-0 text-right text-xs text-muted">{formatNumber(Math.round(progress), locale)} %</span>
                      </div>}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="py-5 text-sm text-muted">{t('noBudgets')}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
