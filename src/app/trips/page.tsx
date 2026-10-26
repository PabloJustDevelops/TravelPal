"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import slots from "@/components/ui/interiorSlots.module.css";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Button from "@/components/ui/Button";
import PageTitle from "@/components/ui/PageTitle";
import Input from "@/components/ui/Input";
import { accentLinkClassName } from "@/components/ui/actionStyles";
import { selectClassName } from "@/components/ui/fieldStyles";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient, Trip } from "@/lib/insforge";
import {
  queryErrorKind,
  withQueryTimeout,
  type QueryErrorKind,
} from "@/lib/insforge-query";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  MapIcon,
  CalendarDaysIcon,
  MapPinIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import DeleteTripButton from "@/components/trips/DeleteTripButton";
import TripInvitationInbox from "@/components/trips/TripInvitationInbox";
import { logger } from "@/lib/logger";
import { getErrorMessage, getLoadErrorMessage } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { localePath } from "@/lib/i18n";

const tripStatusKeys = { planned: "tripStatusPlanned", confirmed: "tripStatusConfirmed", completed: "tripStatusCompleted", cancelled: "tripStatusCancelled" } as const;

function getTripEndDate(trip: Trip) {
  return new Date(trip.return_date || trip.departure_date);
}

function isUpcomingTrip(trip: Trip) {
  return (
    trip.status !== "cancelled" &&
    new Date(trip.departure_date) > new Date()
  );
}

function formatTripDates(trip: Trip, locale: "es" | "en") {
  const format = (value: string) =>
    new Date(value).toLocaleDateString(locale === "en" ? "en-US" : "es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  return trip.return_date
    ? `${format(trip.departure_date)} – ${format(trip.return_date)}`
    : format(trip.departure_date);
}

export default function TripsPage() {
  const { user, loading: authLoading } = useAuth();
  const { locale, t } = useI18n();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{
    kind: QueryErrorKind;
  } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      setTrips([]);
      setLoading(false);
      return;
    }

    let active = true;

    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const insforge = createInsforgeClient();
        const { data, error } = await withQueryTimeout(
          insforge
            .database.from("trips")
            .select("*")
            .order("departure_date", { ascending: false }),
          { label: "trips" },
        );

        if (error) throw error;

        if (!active) return;
        setTrips((data as Trip[]) ?? []);
      } catch (err) {
        if (!active) return;
        logger.error("TripsPage: Error loading trips", {
          error: getErrorMessage(err, "Error al cargar los viajes"),
        });
        setLoadError({ kind: queryErrorKind(err) });
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authLoading, user?.id, reloadToken]);

  const filteredTrips = useMemo(() => {
    let filtered = trips;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (trip) =>
          trip.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          trip.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
          trip.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
          formatTripDates(trip, locale).toLowerCase().includes(searchTerm.toLowerCase()) ||
          trip.departure_date.toLowerCase().includes(searchTerm.toLowerCase()) ||
          trip.airline?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          trip.flight_number?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      if (statusFilter === "upcoming") {
        filtered = filtered.filter(
          (trip) => isUpcomingTrip(trip),
        );
      } else {
        filtered = filtered.filter((trip) => trip.status === statusFilter);
      }
    }

    return filtered;
  }, [trips, searchTerm, statusFilter, locale]);

  const nextTrip = useMemo(
    () =>
      filteredTrips
        .filter((trip) => isUpcomingTrip(trip) && trip.status !== "completed")
        .sort(
          (first, second) =>
            new Date(first.departure_date).getTime() -
            new Date(second.departure_date).getTime(),
        )[0],
    [filteredTrips],
  );
  const otherTrips = filteredTrips.filter((trip) => trip.id !== nextTrip?.id);

  const error = getLoadErrorMessage(loadError, {
    timeout: t("dashboardLoadTimeout"),
    request: t("tripsLoadRequest"),
  });

  const showSkeleton = authLoading || loading;

  if (showSkeleton) {
    return <DashboardLayout skeleton="trips" pending />;
  }

  if (!user) {
    return (
      <DashboardLayout skeleton="trips">
        <div className="mx-auto max-w-xl py-16 text-center font-sans">
          <h3 className="text-lg font-semibold text-ink">
            {t("signInToSeeTrips")}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {t("tripsRequireAuth")}
          </p>
          <Link
            href={(locale === "en" ? localePath(locale, "/signin") : "/signin")}
            className={`${accentLinkClassName} mt-5 min-h-11`}
          >
            {t("goToSignIn")}
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout skeleton="trips">
      <div className="mx-auto max-w-7xl space-y-7 font-sans">
        <PageTitle
          className={slots.tripsTitle}
          title={t("tripsTitle")}
          subtitle={t("tripsSubtitle")}
          action={
            trips.length > 0 ? (
              <Link
                href="/create-trip"
                className={`${accentLinkClassName} min-h-11 gap-2`}
              >
                <PlusIcon aria-hidden="true" className="h-4 w-4" />
                {t("newTrip")}
              </Link>
            ) : undefined
          }
        />

        <TripInvitationInbox onAccepted={refetch} />

        <div data-loading-slot="tripsBody" tabIndex={0} role="region" aria-label={t("navTrips")} className={`${slots.tripsBody} space-y-7`}>
        {/* Filters */}
        {trips.length > 0 && (
          <section
            aria-label={t("filterByStatus")}
            className="rounded-xl border border-line bg-paper p-4 sm:p-5"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Input
                  label={t("searchTrips")}
                  type="search"
                placeholder={t("destinationCityDate")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="min-h-11"
                />
              </div>

              <div className="sm:w-56">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label={t("filterByStatus")}
                  className={`${selectClassName} min-h-11`}
                >
                  <option value="all">{t("allStatuses")}</option>
                  <option value="planned">{t("tripStatusPlanned")}</option>
                  <option value="confirmed">{t("tripStatusConfirmed")}</option>
                  <option value="completed">{t("tripStatusCompleted")}</option>
                  <option value="cancelled">{t("tripStatusCancelled")}</option>
                  <option value="upcoming">{t("upcoming")}</option>
                </select>
              </div>
            </div>
          </section>
        )}

        {/* Error State */}
        {error ? (
          <div role="alert" className="rounded-xl border border-danger bg-danger/10 p-5 text-center text-danger">
            <p className="font-medium mb-2">{t("tripsLoadProblem")}</p>
            <p className="text-sm mb-4">{error}</p>
            <Button 
              onClick={() => {
                refetch();
              }}
              variant="outline"
              className="mt-1 min-h-11 bg-paper hover:bg-surface-strong text-danger border-danger"
            >
              {t("retry")}
            </Button>
          </div>
        ) : filteredTrips.length > 0 ? (
          <div className="space-y-8">
            {nextTrip && (
              <article className="relative overflow-hidden rounded-xl border border-line bg-paper">
                <div className="grid min-h-72 items-stretch">
                  <div className="flex min-w-0 flex-col justify-center p-5 sm:p-8 lg:p-10">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{t("nextTripLabel")}</p>
                    <h2 className="mt-2 break-words text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
                      <Link href={`${(locale === "en" ? localePath(locale, "/trip") : "/trip")}?id=${encodeURIComponent(nextTrip.id)}`} className="rounded-sm hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                        {nextTrip.title}
                      </Link>
                    </h2>
                    <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted sm:text-base">
                      <MapPinIcon className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                      {nextTrip.origin} <span aria-hidden="true">→</span> {nextTrip.destination}
                    </p>
                    <p className="mt-3 flex items-center gap-2 text-sm text-muted sm:text-base">
                      <CalendarDaysIcon className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                      {formatTripDates(nextTrip, locale)}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <span className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold ${
                        nextTrip.status === "confirmed" ? "bg-success/10 text-success" : "bg-accent-soft text-accent"
                      }`}>
                        {t(tripStatusKeys[nextTrip.status] ?? "tripStatusPlanned")}
                      </span>
                      {nextTrip.user_id !== user.id && <span className="text-xs font-medium text-muted">{t("sharedBy")}</span>}
                      {new Date(nextTrip.departure_date).getTime() > Date.now() && (
                        <span className="text-sm font-medium text-ink">
                          {new Intl.RelativeTimeFormat(locale === "en" ? "en" : "es", { numeric: "auto" }).format(
                            Math.ceil((new Date(nextTrip.departure_date).getTime() - Date.now()) / 86_400_000),
                            "day",
                          )}
                        </span>
                      )}
                    </div>
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <Link
                        href={`${(locale === "en" ? localePath(locale, "/trip") : "/trip")}?id=${encodeURIComponent(nextTrip.id)}`}
                        className={`${accentLinkClassName} min-h-11 gap-2`}
                      >
                        {t("openTrip")} <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      {nextTrip.user_id === user.id && <DeleteTripButton
                        trip={nextTrip}
                        onDeleted={() => setTrips((prev) => prev.filter((item) => item.id !== nextTrip.id))}
                      />}
                    </div>
                  </div>

                </div>
              </article>
            )}

            {otherTrips.length > 0 && (
              <section aria-labelledby="other-trips-heading">
                <div className="border-b border-line pb-3">
                  <h2 id="other-trips-heading" className="text-2xl font-bold tracking-tight text-ink">
                    {otherTrips.every((trip) => getTripEndDate(trip).getTime() < Date.now())
                      ? t("rememberTrips")
                      : t("otherTrips")}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {otherTrips.every((trip) => getTripEndDate(trip).getTime() < Date.now())
                      ? t("rememberedTripsDescription")
                      : t("otherTripsDescription")}
                  </p>
                </div>
                <div className="divide-y divide-line">
                  {otherTrips.map((trip) => (
                    <article key={trip.id} className="grid min-w-0 gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold tracking-tight text-ink">
                          <Link href={`${(locale === "en" ? localePath(locale, "/trip") : "/trip")}?id=${encodeURIComponent(trip.id)}`} className="rounded-sm hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                            {trip.title}
                          </Link>
                        </h3>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                          <CalendarDaysIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          {formatTripDates(trip, locale)}
                          <span aria-hidden="true">·</span>
                          {trip.origin} <span aria-hidden="true">→</span> {trip.destination}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                        <span className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold ${
                          trip.status === "confirmed" ? "bg-success/10 text-success" :
                          trip.status === "cancelled" ? "bg-danger/10 text-danger" :
                          trip.status === "completed" ? "bg-accent-soft text-accent" : "bg-surface text-muted"
                        }`}>
                          {t(tripStatusKeys[trip.status] ?? "tripStatusPlanned")}
                        </span>
                        {trip.user_id !== user.id && <span className="text-xs font-medium text-muted">{t("sharedBy")}</span>}
                        <Link href={`${(locale === "en" ? localePath(locale, "/trip") : "/trip")}?id=${encodeURIComponent(trip.id)}`} className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-accent hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                          {t("viewTrip")} <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                        </Link>
                        {trip.user_id === user.id && <DeleteTripButton
                          trip={trip}
                          onDeleted={() => setTrips((prev) => prev.filter((item) => item.id !== trip.id))}
                        />}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : trips.length > 0 ? (
          <section className="rounded-xl border border-line bg-paper px-5 py-12 text-center" aria-live="polite">
            <MagnifyingGlassIcon aria-hidden="true" className="mx-auto h-8 w-8 text-muted" />
            <h2 className="mt-4 text-lg font-semibold text-ink">{t("noMatchingTrips")}</h2>
            <p className="mt-2 text-sm text-muted">{t("changeFiltersHint")}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-5 min-h-11"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
              }}
            >
              {t("clearFilters")}
            </Button>
          </section>
        ) : (
          <EmptyState
            icon={<MapIcon className="h-7 w-7" />}
            title={t("noTrips")}
            description={t("firstTripDescription")}
            action={(
              <Link
                href="/create-trip"
                className={`${accentLinkClassName} min-h-11 gap-2`}
              >
                <PlusIcon aria-hidden="true" className="h-4 w-4" />
                {t("createFirstTrip")}
              </Link>
            )}
          />
        )}
        </div>
      </div>
    </DashboardLayout>
  );
}
