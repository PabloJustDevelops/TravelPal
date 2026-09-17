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
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { CurrencyDollarIcon, TicketIcon } from "@heroicons/react/24/outline";

interface TripSummaryProps {
  tripId: string;
}

const LOAD_ERROR = "No se pudo cargar el resumen del viaje";

export default function TripSummary({ tripId }: TripSummaryProps) {
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
    timeout: "La carga del resumen ha tardado demasiado.",
    request: LOAD_ERROR,
  });

  if (loading) {
    return (
      <Card>
        <CardContent
          role="status"
          aria-label="Cargando el resumen del viaje"
          className="flex justify-center py-8"
        >
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  if (loadErrorMessage) {
    return (
      <Card>
        <CardContent className="py-2">
          <ErrorState message={loadErrorMessage} onRetry={load} />
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const isEmpty = summary.expenseCount === 0 && summary.bookingCount === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TicketIcon className="h-5 w-5 text-muted" aria-hidden="true" />
          Resumen del viaje
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <EmptyState
            title="Sin gastos ni reservas todavia"
            description="Cuando registres gastos o reservas, aqui veras el resumen del viaje."
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <CurrencyDollarIcon className="h-4 w-4" aria-hidden="true" />
                Gastos
              </p>
              <p className="mt-1 font-serif text-heading leading-snug text-ink">
                {summary.expenseCount}
              </p>
              {summary.expensesByCurrency.length > 0 ? (
                <ul className="mt-1 space-y-1 text-sm text-ink">
                  {summary.expensesByCurrency.map((total) => (
                    <li key={total.currency}>
                      {formatCurrency(total.total, total.currency)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted">
                  Sin importes registrados
                </p>
              )}
            </div>

            <div>
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <TicketIcon className="h-4 w-4" aria-hidden="true" />
                Reservas
              </p>
              <p className="mt-1 font-serif text-heading leading-snug text-ink">
                {summary.bookingCount}
              </p>
              {summary.bookingsByCurrency.length > 0 ? (
                <ul className="mt-1 space-y-1 text-sm text-ink">
                  {summary.bookingsByCurrency.map((total) => (
                    <li key={total.currency}>
                      {formatCurrency(total.total, total.currency)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted">
                  Sin importes registrados
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
