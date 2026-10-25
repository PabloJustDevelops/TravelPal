import type { Trip } from "@/lib/insforge";
import { formatCurrency } from "@/lib/utils";
import CategoryIcon from "@/components/ui/CategoryIcon";
import { CalendarIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { useI18n } from '@/lib/i18n/LocaleProvider';

interface Props {
  data: {
    amount: string;
    currency: string;
    description: string;
    category: string;
    date: string;
    trip_id: string;
  };
  trips: Trip[];
  categoryLabel?: string;
}
export default function ExpenseSummary({ data, trips, categoryLabel }: Props) {
  const { t, locale } = useI18n();
  const trip = trips.find((trip) => trip.id === data.trip_id);
  const amount = Number(data.amount);
  return (
    <aside
      aria-label={t('expenseSummaryLabel')}
      className="self-start border-t border-line pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"
    >
      <h2 className="text-xl font-bold text-ink">{t('expenseSummaryTitle')}</h2>
      <p className="mt-5 break-words text-3xl font-bold tracking-tight tabular-nums text-ink">
        {Number.isFinite(amount) && amount > 0
          ? formatCurrency(amount, data.currency, locale)
          : formatCurrency(0, data.currency, locale)}
      </p>
      <p className="mt-2 break-words text-lg text-ink">
        {data.description || t('expenseAddDescription')}
      </p>
      <dl className="mt-6 space-y-5 border-y border-line py-6 text-muted">
        <div className="flex items-center gap-3">
          <CategoryIcon category={data.category} className="h-6 w-6 shrink-0" />
          <dt className="sr-only">{t('expenseCategory')}</dt>
          <dd>{categoryLabel || data.category}</dd>
        </div>
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
          <dt className="sr-only">{t('expenseDate')}</dt>
          <dd>
            {data.date && !Number.isNaN(Date.parse(data.date))
              ? new Date(data.date).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : t('expenseChooseDate')}
          </dd>
        </div>
        <div className="flex items-center gap-3">
          <PaperAirplaneIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
          <dt className="sr-only">{t('expenseTrip')}</dt>
          <dd className="break-words">{trip?.title || t('noTripOption')}</dd>
        </div>
      </dl>
      <p className="mt-6 text-sm leading-relaxed text-muted">
        {t('expenseSavedIn').replace('{currency}', data.currency)}
        {trip ? ` ${locale === 'en' ? 'for' : 'para'} ${trip.title}` : ''}.
      </p>
    </aside>
  );
}
