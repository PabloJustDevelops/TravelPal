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
import { CONNECTION_TIMEOUT_MESSAGE, getLoadErrorMessage } from "@/lib/utils";

interface TripItineraryProps {
  tripId: string;
  startDate: string;
  endDate: string;
  userId: string;
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
}: TripItineraryProps) {
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
      assertRowsAffected(data, "No se pudo guardar la actividad");
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
      assertRowsAffected(data, "No se pudo actualizar la actividad");
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
      assertRowsAffected(data, "No se pudo eliminar la actividad");
      refetch();
    },
    [refetch],
  );

  const errorMessage = getLoadErrorMessage(
    loadError ? { kind: loadError } : null,
    {
      timeout: CONNECTION_TIMEOUT_MESSAGE,
      request: "No se pudo cargar el itinerario del viaje",
    },
  );

  return (
    <Card className="overflow-hidden bg-paper">
      <CardHeader className="flex-row items-center justify-between gap-4 border-b-0 px-5 pb-0 pt-5 sm:px-6 sm:pt-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            Plan del viaje
          </p>
          <h2 className="mt-1 font-sans text-xl font-semibold text-ink">
            Itinerario
          </h2>
        </div>
        <Link
          href="/planning"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-medium text-accent hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Planificación <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-3 sm:px-6 sm:pb-6">
        {loading ? (
          <div role="status" aria-label="Cargando itinerario" className="py-8">
            <LoadingSpinner />
          </div>
        ) : errorMessage ? (
          <div role="alert" className="py-8 text-center">
            <h3 className="font-sans text-lg font-semibold text-ink">Itinerario temporalmente no disponible</h3>
            <p className="mt-2 text-sm leading-reading text-muted">{errorMessage}</p>
            <Button onClick={retry} className="mt-4">Reintentar</Button>
          </div>
        ) : (
          <>
            {activities.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MapIcon className="mb-3 h-8 w-8 text-muted" aria-hidden="true" />
                <h3 className="font-sans text-lg font-semibold text-ink">Tu itinerario empieza aquí</h3>
                <p className="mt-2 max-w-prose text-sm leading-reading text-muted">
                  Añade actividades por día y mantén el plan de este viaje en un solo lugar.
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
              className="space-y-4"
              headingLevel={3}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
