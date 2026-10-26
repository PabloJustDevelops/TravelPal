"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, MapIcon } from "@heroicons/react/24/outline";
import {
  ItineraryPlanner,
  toPlannerCategory,
  type DayItinerary,
  type PlannerActivity,
  type PlannerActivityDraft,
} from "@/components/planning/ItineraryPlanner";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import type { ItineraryActivity } from "@/lib/insforge";
import { createInsforgeClient } from "@/lib/insforge";
import {
  assertRowsAffected,
  queryErrorKind,
  withQueryTimeout,
  type QueryErrorKind,
} from "@/lib/insforge-query";
import { logger } from "@/lib/logger";
import { getLoadErrorMessage } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LocaleProvider";

interface TripItineraryProps {
  tripId: string;
  startDate: string;
  endDate: string;
  userId: string;
  readOnly?: boolean;
}

function toDayItinerary(activities: ItineraryActivity[]): DayItinerary[] {
  const days = new Map<string, PlannerActivity[]>();

  for (const activity of activities) {
    const day = activity.date.slice(0, 10);
    const existing = days.get(day) ?? [];
    existing.push({
      id: activity.id,
      title: activity.title,
      description: activity.description,
      startTime: activity.start_time ?? "",
      endTime: activity.end_time ?? "",
      location: activity.location,
      category: toPlannerCategory(activity.category),
      cost: activity.cost,
      currency: activity.currency,
      notes: activity.notes,
      completed: activity.completed,
    });
    days.set(day, existing);
  }

  return [...days.entries()].map(([date, dayActivities]) => ({
    date,
    activities: dayActivities,
  }));
}

export default function TripItinerary({
  tripId,
  startDate,
  endDate,
  userId,
  readOnly = false,
}: TripItineraryProps) {
  const { t } = useI18n();
  const [activities, setActivities] = useState<ItineraryActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<QueryErrorKind | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);
  const retry = useCallback(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoadError(null);

      try {
        const { data, error } = await withQueryTimeout(
          createInsforgeClient()
            .database.from("itinerary_activities")
            .select("*")
            .eq("trip_id", tripId)
            .order("date", { ascending: true })
            .order("order_index", { ascending: true }),
          { label: "trip-itinerary" },
        );

        if (error) throw error;
        if (active) setActivities((data ?? []) as ItineraryActivity[]);
      } catch (error) {
        logger.error("TripItinerary: no se pudo cargar el itinerario", error);
        if (active) setLoadError(queryErrorKind(error));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [tripId, reloadToken]);

  const saveActivity = useCallback(
    async (date: string, activity: PlannerActivityDraft) => {
      const orderIndex = activities.filter(
        (item) => item.date.slice(0, 10) === date,
      ).length;
      const { data, error } = await withQueryTimeout(
        createInsforgeClient()
          .database.from("itinerary_activities")
          .insert([
            {
              user_id: userId,
              trip_id: tripId,
              date,
              title: activity.title,
              description: activity.description || null,
              start_time: activity.startTime || null,
              end_time: activity.endTime || null,
              location: activity.location || null,
              category: activity.category,
              cost: activity.cost ?? null,
              currency: activity.currency || "EUR",
              notes: activity.notes || null,
              completed: activity.completed ?? false,
              order_index: orderIndex,
            },
          ])
          .select(),
        { label: "activities:insert" },
      );
      if (error) throw error;
      assertRowsAffected(data, t("activitySaveError"));
      refetch();
    },
    [activities, refetch, tripId, userId],
  );

  const updateActivity = useCallback(
    async (activityId: string, activity: PlannerActivityDraft) => {
      const { data, error } = await withQueryTimeout(
        createInsforgeClient()
          .database.from("itinerary_activities")
          .update({
            title: activity.title,
            description: activity.description || null,
            start_time: activity.startTime || null,
            end_time: activity.endTime || null,
            location: activity.location || null,
            category: activity.category,
            cost: activity.cost ?? null,
            currency: activity.currency || "EUR",
            notes: activity.notes || null,
            completed: activity.completed ?? false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", activityId)
          .select(),
        { label: "activities:update" },
      );
      if (error) throw error;
      assertRowsAffected(data, t("activityUpdateError"));
      refetch();
    },
    [refetch],
  );

  const deleteActivity = useCallback(
    async (activityId: string) => {
      const { data, error } = await withQueryTimeout(
        createInsforgeClient()
          .database.from("itinerary_activities")
          .delete()
          .eq("id", activityId)
          .select(),
        { label: "activities:delete" },
      );
      if (error) throw error;
      assertRowsAffected(data, t("activityDeleteError"));
      refetch();
    },
    [refetch],
  );

  const errorMessage = getLoadErrorMessage(
    loadError ? { kind: loadError } : null,
    {
      timeout: t("connectionTimeout"),
      request: t("itineraryUnavailable"),
    },
  );

  return (
    <Card className="overflow-hidden rounded-none border-0 bg-transparent">
      <CardHeader className="flex-row items-center justify-between gap-4 border-b border-line px-0 pb-4 pt-0">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            {t("itineraryPlan")}
          </p>
          <h2 className="mt-1 font-sans text-xl font-semibold text-ink">
            {t("itinerary")}
          </h2>
        </div>
        {!readOnly && <Link
          href="/planning"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-medium text-accent hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {t("planning")} <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>}
      </CardHeader>
      <CardContent className="px-0 py-5">
        {loading ? (
          <div role="status" aria-label={t("itineraryLoading")} className="py-8">
            <LoadingSpinner />
          </div>
        ) : errorMessage ? (
          <div role="alert" className="py-8 text-center">
            <h3 className="font-sans text-lg font-semibold text-ink">{t("itineraryUnavailable")}</h3>
            <p className="mt-2 text-sm leading-reading text-muted">{errorMessage}</p>
            <Button onClick={retry} className="mt-4">{t("retry")}</Button>
          </div>
        ) : (
          <>
            {activities.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MapIcon className="mb-3 h-8 w-8 text-muted" aria-hidden="true" />
                <h3 className="font-sans text-lg font-semibold text-ink">{t("itineraryStart")}</h3>
                <p className="mt-2 max-w-prose text-sm leading-reading text-muted">
                  {t("itineraryEmptyHint")}
                </p>
              </div>
            )}
            <ItineraryPlanner
              startDate={startDate}
              endDate={endDate}
              itinerary={toDayItinerary(activities)}
              onCreateActivity={saveActivity}
              onUpdateActivity={updateActivity}
              onDeleteActivity={deleteActivity}
              readOnly={readOnly}
              className="space-y-4"
              headingLevel={3}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
