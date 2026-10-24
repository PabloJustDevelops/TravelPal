"use client";

import { useCallback, useEffect, useState } from "react";
import type { Booking, Expense } from "@/lib/insforge";
import { createInsforgeClient } from "@/lib/insforge";
import {
  queryErrorKind,
  withQueryTimeout,
  type QueryErrorKind,
} from "@/lib/insforge-query";
import { logger } from "@/lib/logger";
import {
  summarizeTrip,
  type TripSummary as TripSummaryData,
} from "@/lib/trip-summary";
import { formatCurrency, getLoadErrorMessage } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { CurrencyDollarIcon, TicketIcon } from "@heroicons/react/24/outline";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { formatNumber } from "@/lib/i18n";

interface TripSummaryProps {
  tripId: string;
}



export default function TripSummary({ tripId }: TripSummaryProps) {
  const { locale, t } = useI18n();
  const [summary, setSummary] = useState<TripSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{
    kind: QueryErrorKind;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const insforge = createInsforgeClient();

      const [expensesRes, bookingsRes] = await withQueryTimeout(
        Promise.all([
          insforge.database.from("expenses").select("*").eq("trip_id", tripId),
          insforge.database.from("bookings").select("*").eq("trip_id", tripId),
        ]),
        { label: "trip-summary" },
      );

      if (expensesRes.error) throw expensesRes.error;
      if (bookingsRes.error) throw bookingsRes.error;

      setSummary(
        summarizeTrip(
          (expensesRes.data ?? []) as Expense[],
          (bookingsRes.data ?? []) as Booking[],
        ),
      );
    } catch (err) {
      logger.error("TripSummary: load failed", err);
      setLoadError({ kind: queryErrorKind(err) });
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadErrorMessage = getLoadErrorMessage(loadError, {
    timeout: t("summaryTimeout"),
    request: t("summaryLoadRequest"),
  });

  if (loading) {
    return (
      <Card className="rounded-none border-0 bg-transparent">
        <CardContent
          role="status"
          aria-label={t("summaryLoading")}
          className="flex justify-center border-t border-line px-0 py-8"
        >
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  if (loadErrorMessage) {
    return (
      <Card className="rounded-none border-0 bg-transparent">
        <CardContent className="border-t border-line px-0 py-5">
          <div role="alert" className="py-8 text-center">
            <h3 className="font-sans text-lg font-semibold text-ink">{t("summaryUnavailable")}</h3>
            <p className="mt-2 text-sm leading-reading text-muted">{loadErrorMessage}</p>
            <Button onClick={load} className="mt-4">{t("retry")}</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const isEmpty = summary.expenseCount === 0 && summary.bookingCount === 0;

  return (
    <Card className="rounded-none border-0 bg-transparent">
      <CardHeader className="border-b border-line px-0 pt-0 pb-4">
        <CardTitle className="flex items-center gap-2 font-sans text-lg font-semibold">
          <TicketIcon className="h-5 w-5 text-muted" aria-hidden="true" />
          {t("tripSummary")}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 py-5">
        {isEmpty ? (
          <div className="py-8 text-center">
            <h3 className="font-sans text-lg font-semibold text-ink">{t("noExpensesOrBookings")}</h3>
            <p className="mt-2 text-sm leading-reading text-muted">
              {t("summaryEmptyHint")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <CurrencyDollarIcon className="h-4 w-4" aria-hidden="true" />
                {t("expenses")}
              </p>
              <p className="mt-1 font-sans text-2xl font-semibold leading-snug text-ink">
                {formatNumber(summary.expenseCount, locale)}
              </p>
              {summary.expensesByCurrency.length > 0 ? (
                <ul className="mt-1 space-y-1 text-sm text-ink">
                  {summary.expensesByCurrency.map((total) => (
                    <li key={total.currency}>
                      {formatCurrency(total.total, total.currency, locale)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted">
                  {t("noAmounts")}
                </p>
              )}
            </div>

            <div>
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <TicketIcon className="h-4 w-4" aria-hidden="true" />
                {t("bookings")}
              </p>
              <p className="mt-1 font-sans text-2xl font-semibold leading-snug text-ink">
                {formatNumber(summary.bookingCount, locale)}
              </p>
              {summary.bookingsByCurrency.length > 0 ? (
                <ul className="mt-1 space-y-1 text-sm text-ink">
                  {summary.bookingsByCurrency.map((total) => (
                    <li key={total.currency}>
                      {formatCurrency(total.total, total.currency, locale)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted">
                  {t("noAmounts")}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
