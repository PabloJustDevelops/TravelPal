"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Button from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient, Trip } from "@/lib/insforge";
import {
  assertRowsAffected,
  queryErrorKind,
  withQueryTimeout,
  type QueryErrorKind,
} from "@/lib/insforge-query";
import { logger } from "@/lib/logger";
import { showToast } from "@/lib/toast";
import {
  getErrorMessage,
  getLoadErrorMessage,
} from "@/lib/utils";
import EditTripModal from "@/components/trips/EditTripModal";
import DeleteTripButton from "@/components/trips/DeleteTripButton";
import TripJournal from "@/components/trips/TripJournal";
import TripSummary from "@/components/trips/TripSummary";
import TripItinerary from "@/components/trips/TripItinerary";
import {
  ArrowLeftIcon,
  CalendarIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { localePath } from "@/lib/i18n";

const TRIP_STATUS_KEYS = { planned: "tripStatusPlanned", confirmed: "tripStatusConfirmed", completed: "tripStatusCompleted", cancelled: "tripStatusCancelled" } as const;

function tripDate(value: string, locale: "es" | "en", options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
  }).format(new Date(value));
}

function tripTime(value: string, locale: "es" | "en") {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function TripDetailsContent() {
  const { locale, t } = useI18n();
  const id = useSearchParams().get("id")?.trim() ?? "";

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tripResult, setTripResult] = useState<{ id: string; trip: Trip } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErrorResult, setLoadErrorResult] = useState<{
    id: string;
    error: { kind: QueryErrorKind };
  } | null>(null);
  const [notFoundId, setNotFoundId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);
  const loadRequestId = useRef(0);
  const trip = tripResult?.id === id ? tripResult.trip : null;
  const loadError = loadErrorResult?.id === id ? loadErrorResult.error : null;
  const notFound = notFoundId === id;

  const loadTrip = useCallback(async () => {
    const requestId = ++loadRequestId.current;
    try {
      // Don't set loading to true here to avoid full page spinner on refresh
      // setLoading(true); 
      const insforge = createInsforgeClient();

      const { data, error } = await withQueryTimeout(
        insforge.database.from("trips").select("*").eq("id", id).single(),
        { label: "trips:detail" },
      );

      if (error) {
        if ((error as { code?: string }).code === "PGRST116") {
          if (requestId !== loadRequestId.current) return;
          setNotFoundId(id);
          setLoadErrorResult((current) => current?.id === id ? null : current);
          return;
        }
        throw error;
      }

      if (!data) {
        if (requestId !== loadRequestId.current) return;
        setNotFoundId(id);
        setLoadErrorResult((current) => current?.id === id ? null : current);
        return;
      }

      if (requestId !== loadRequestId.current) return;
      setTripResult({ id, trip: data });
      setNotFoundId((current) => current === id ? null : current);
      setLoadErrorResult((current) => current?.id === id ? null : current);
    } catch (err: unknown) {
      if (requestId !== loadRequestId.current) return;
      logger.error("Error loading trip details:", err);
      setLoadErrorResult({ id, error: { kind: queryErrorKind(err) } });
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (authLoading) return;
    if (!id) return;

    if (!user) {
      router.push((locale === "en" ? localePath(locale, "/signin") : "/signin"));
      return;
    }

    setLoading(true);
    loadTrip();
  }, [id, user, authLoading, router, loadTrip, locale]);

  const error = getLoadErrorMessage(loadError, {
    timeout: t("connectionTimeout"),
    request: t("tripLoadError"),
  });

  if (!id) {
    return (
      <DashboardLayout skeleton="trip">
        <p role="alert" className="mx-auto max-w-xl rounded-xl bg-surface px-6 py-10 text-center text-muted">{t("detailNoSelection")}</p>
      </DashboardLayout>
    );
  }

  if (loading || authLoading || (!trip && !error && !notFound)) {
    return <DashboardLayout skeleton="trip" pending />;
  }

  if (error || !trip) {
    if (notFound) {
      return (
        <DashboardLayout skeleton="trip">
          <p role="alert" className="mx-auto max-w-xl rounded-xl bg-surface px-6 py-10 text-center text-muted">{t("tripNotFound")}</p>
        </DashboardLayout>
      );
    }
    return (
      <DashboardLayout skeleton="trip">
        <section className="mx-auto max-w-xl rounded-xl bg-surface px-6 py-10 text-center" aria-labelledby="trip-load-error">
          <h1 id="trip-load-error" className="font-sans text-2xl font-semibold text-ink">{t("tripOpenError")}</h1>
          <p className="mb-6 mt-3 text-muted">{error || t("tripNotFound")}</p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              onClick={() => {
                setNotFoundId(null);
                setLoadErrorResult(null);
                setLoading(true);
                loadTrip();
              }}
            >
              {t("retry")}
            </Button>
            <Link href={(locale === "en" ? localePath(locale, "/trips") : "/trips")} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-sm font-medium text-ink hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
              {t("backToTrips")}
            </Link>
          </div>
        </section>
      </DashboardLayout>
    );
  }

  const tripEnd = trip.return_date
    ? new Date(trip.return_date).getTime()
    : new Date(trip.departure_date).getTime();
  const isPast =
    trip.status === "completed" || (!Number.isNaN(tripEnd) && tripEnd < Date.now());

  const markCompleted = async () => {
    setMarkingComplete(true);

    try {
      const insforge = createInsforgeClient();
      const { data: updatedRows, error: updateError } = await withQueryTimeout(
        insforge.database
          .from("trips")
          .update({ status: "completed" })
          .eq("id", trip.id)
          .select(),
        { label: "trips:complete" },
      );

      if (updateError) throw updateError;
      assertRowsAffected(updatedRows, t("markTripError"));
      await loadTrip();
    } catch (err) {
      const message =
        queryErrorKind(err) === "timeout"
          ? t("connectionTimeout")
          : getErrorMessage(err, t("markTripError"));
      logger.error("TripDetailsPage: mark completed failed", { error: message });
      showToast({
        type: "error",
        title: t("markTripErrorTitle"),
        message,
      });
    } finally {
      setMarkingComplete(false);
    }
  };

  return (
    <DashboardLayout skeleton="trip">
      <div className="mx-auto max-w-7xl space-y-6 font-sans">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href={(locale === "en" ? localePath(locale, "/trips") : "/trips")} className="inline-flex min-h-11 items-center gap-2 rounded-md pr-3 text-sm font-medium text-muted hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />{t("myTrips")}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setIsEditModalOpen(true)}>
              {t("editTrip")}
            </Button>
            <DeleteTripButton trip={trip} size="md" onDeleted={() => router.push((locale === "en" ? localePath(locale, "/trips") : "/trips"))} />
          </div>
        </div>

        <header className="border-b border-line pb-6 sm:pb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{t("yourTrip")}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  trip.status === "confirmed" || trip.status === "completed"
                    ? "bg-success/10 text-success"
                    : trip.status === "cancelled"
                      ? "bg-danger/10 text-danger"
                      : "bg-accent-soft text-accent"
                }`}>
                  {t(TRIP_STATUS_KEYS[trip.status])}
                </span>
              </div>
              <h1 className="mt-2 break-words text-[28px] font-bold leading-tight tracking-tight text-ink sm:text-[38px]">{trip.title}</h1>
              <p className="mt-2 flex items-center gap-2 text-base text-muted">
                <MapPinIcon className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                <span>{trip.origin}</span><span aria-hidden="true">→</span><span>{trip.destination}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-sm text-muted">
              <CalendarIcon className="h-5 w-5 text-accent" aria-hidden="true" />
              <span>
                {tripDate(trip.departure_date, locale)}
                {trip.return_date && <> <span aria-hidden="true">–</span> {tripDate(trip.return_date, locale)}</>}
                <span className="mt-1 block text-xs text-muted">
                  {t("departure")} {tripTime(trip.departure_date, locale)}
                  {trip.return_date && <> · {t("return")} {tripTime(trip.return_date, locale)}</>}
                </span>
              </span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.85fr)]">
          <div className="min-w-0 space-y-6">
            <TripItinerary
              tripId={trip.id}
              startDate={trip.departure_date}
              endDate={trip.return_date || trip.departure_date}
              userId={user?.id ?? trip.user_id}
            />

            {trip.notes && (
              <section className="border-b border-line pb-6" aria-labelledby="trip-notes-heading">
                <h2 id="trip-notes-heading" className="text-lg font-semibold text-ink">{t("tripNotes")}</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-reading text-muted">{trip.notes}</p>
              </section>
            )}

            {isPast ? (
              <TripJournal tripId={trip.id} />
            ) : (
              <section className="border-b border-line pb-6" aria-labelledby="trip-journal-heading">
                <h2 id="trip-journal-heading" className="text-lg font-semibold text-ink">{t("tripJournal")}</h2>
                <p className="mb-4 mt-2 text-sm leading-reading text-muted">
                  {t("journalAvailableAfter")}
                </p>
                <Button onClick={markCompleted} disabled={markingComplete}>
                  {markingComplete ? t("marking") : t("markCompleted")}
                </Button>
              </section>
            )}
          </div>

          <aside className="min-w-0 space-y-6 lg:border-l lg:border-line lg:pl-6" aria-label={t("tripSummaryAndDetails")}>
            <TripSummary tripId={trip.id} />

            {(trip.airline || trip.flight_number || trip.confirmation_number) && (
              <section className="border-t border-line pt-5" aria-labelledby="flight-details-heading">
                <h2 id="flight-details-heading" className="text-lg font-semibold text-ink">{t("flightInformation")}</h2>
                <dl className="mt-4 space-y-4">
                  {trip.airline && <div><dt className="text-sm text-muted">{t("airline")}</dt><dd className="mt-1 text-sm font-medium text-ink">{trip.airline}</dd></div>}
                  {trip.flight_number && <div><dt className="text-sm text-muted">{t("flightNumber")}</dt><dd className="mt-1 text-sm font-medium text-ink">{trip.flight_number}</dd></div>}
                  {trip.confirmation_number && <div><dt className="text-sm text-muted">{t("confirmation")}</dt><dd className="mt-1 break-all rounded-md bg-surface px-3 py-2 font-mono text-sm text-ink">{trip.confirmation_number}</dd></div>}
                </dl>
              </section>
            )}

            <section className="border-t border-line pt-5" aria-labelledby="tasks-general-heading">
              <h2 id="tasks-general-heading" className="text-base font-semibold text-ink">{t("tasks")}</h2>
              <p className="mt-2 text-sm leading-reading text-muted">{t("tasksGeneralList")}</p>
              <Link href="/tasks" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md font-medium text-accent hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                {t("viewTasksLink")} <ArrowLeftIcon className="h-4 w-4 rotate-180" aria-hidden="true" />
              </Link>
            </section>
          </aside>
        </div>
      </div>

      {trip && (
        <EditTripModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={loadTrip}
          trip={trip}
        />
      )}
    </DashboardLayout>
  );
}

export default function TripPage() {
  return (
    <Suspense fallback={<DashboardLayout skeleton="trip" pending />}>
      <TripDetailsContent />
    </Suspense>
  );
}
