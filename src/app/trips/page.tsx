"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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
  PlayIcon,
  MapIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import PageSkeleton from "@/components/ui/PageSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import DeleteTripButton from "@/components/trips/DeleteTripButton";
import { logger } from "@/lib/logger";
import { getErrorMessage, getLoadErrorMessage } from "@/lib/utils";

const tripStatusLabels: Record<string, string> = {
  planned: "Planificado",
  confirmed: "Confirmado",
  completed: "Completado",
  cancelled: "Cancelado",
};

export default function TripsPage() {
  const { user, loading: authLoading } = useAuth();
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

    const userId = user.id;
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
            .eq("user_id", userId)
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
          trip.airline?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          trip.flight_number?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      if (statusFilter === "upcoming") {
        filtered = filtered.filter(
          (trip) =>
            new Date(trip.departure_date) > new Date() &&
            trip.status !== "cancelled",
        );
      } else {
        filtered = filtered.filter((trip) => trip.status === statusFilter);
      }
    }

    return filtered;
  }, [trips, searchTerm, statusFilter]);

  const error = getLoadErrorMessage(loadError, {
    timeout: "La carga de viajes ha tardado demasiado. Por favor, reintenta.",
    request: "Error al cargar los viajes. Por favor, intenta recargar.",
  });

  const showSkeleton = authLoading || loading;

  if (showSkeleton) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl py-16 text-center font-sans">
          <h3 className="text-lg font-semibold text-ink">
            Inicia sesión para ver tus viajes
          </h3>
          <p className="mt-1 text-sm text-muted">
            La sección de viajes requiere autenticación.
          </p>
          <Link
            href="/signin"
            className={`${accentLinkClassName} mt-5 min-h-11`}
          >
            Ir a Login
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 font-sans">
        {/* Header */}
        <PageTitle
          title="Mis Viajes"
          subtitle="Gestiona tus itinerarios y reservas"
          action={
            trips.length > 0 ? (
              <Link
                href="/trips/new"
                className={`${accentLinkClassName} min-h-11 gap-2`}
              >
                <PlusIcon aria-hidden="true" className="h-4 w-4" />
                Nuevo viaje
              </Link>
            ) : undefined
          }
        />

        {/* Filters */}
        {trips.length > 0 && (
          <section
            aria-label="Filtros de viajes"
            className="rounded-xl border border-line bg-paper p-4 sm:p-5"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Input
                  label="Buscar viajes"
                  type="search"
                  placeholder="Destino, origen, título o vuelo"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="min-h-11"
                />
              </div>

              <div className="sm:w-56">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filtrar por estado"
                  className={`${selectClassName} min-h-11`}
                >
                  <option value="all">Todos los estados</option>
                  <option value="planned">Planificado</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="completed">Completado</option>
                  <option value="cancelled">Cancelado</option>
                  <option value="upcoming">Próximos</option>
                </select>
              </div>
            </div>
          </section>
        )}

        {/* Error State */}
        {error ? (
          <div role="alert" className="rounded-xl border border-danger bg-danger/10 p-5 text-center text-danger">
            <p className="font-medium mb-2">Hubo un problema al cargar tus viajes</p>
            <p className="text-sm mb-4">{error}</p>
            <Button 
              onClick={() => {
                refetch();
              }}
              variant="outline"
              className="mt-1 min-h-11 bg-paper hover:bg-surface-strong text-danger border-danger"
            >
              Reintentar
            </Button>
          </div>
        ) : filteredTrips.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTrips.map((trip) => (
              <article
                key={trip.id}
                className="flex min-w-0 flex-col rounded-xl border border-line bg-paper p-5 transition-colors hover:border-accent/40"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 pr-3">
                    <h2 className="truncate text-lg font-semibold tracking-tight text-ink">
                      <Link
                        href={`/trips/${trip.id}`}
                        className="rounded-sm hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {trip.title}
                      </Link>
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      <span className="sr-only">Ruta: </span>
                      {trip.origin} <span aria-hidden="true">→</span> {trip.destination}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    trip.status === 'confirmed' ? 'bg-success/10 text-success' :
                    trip.status === 'cancelled' ? 'bg-danger/10 text-danger' :
                    trip.status === 'completed' ? 'bg-accent-soft text-accent' :
                    'bg-warning/10 text-warning'
                  }`}>
                    {tripStatusLabels[trip.status] ?? trip.status}
                  </span>
                </div>
                <div className="mt-5 space-y-1 text-sm text-muted">
                  <div className="font-medium text-ink">
                    {new Date(trip.departure_date).toLocaleDateString("es-ES", { dateStyle: "long" })}
                  </div>
                  {trip.return_date && (
                    <div>
                      Hasta el {new Date(trip.return_date).toLocaleDateString("es-ES", { dateStyle: "long" })}
                    </div>
                  )}
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 mt-5">
                  {trip.airline && (
                    <div className="flex min-w-0 items-center gap-2 text-sm text-muted">
                      <PlayIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span className="truncate">{trip.airline}{trip.flight_number ? ` · ${trip.flight_number}` : ""}</span>
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-3">
                    <DeleteTripButton
                      trip={trip}
                      onDeleted={() =>
                        setTrips((prev) => prev.filter((t) => t.id !== trip.id))
                      }
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : trips.length > 0 ? (
          <section className="rounded-xl border border-line bg-paper px-5 py-12 text-center" aria-live="polite">
            <MagnifyingGlassIcon aria-hidden="true" className="mx-auto h-8 w-8 text-muted" />
            <h2 className="mt-4 text-lg font-semibold text-ink">No hay viajes que coincidan con tu búsqueda</h2>
            <p className="mt-2 text-sm text-muted">Prueba con otro término o cambia el estado seleccionado.</p>
            <Button
              type="button"
              variant="outline"
              className="mt-5 min-h-11"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
              }}
            >
              Limpiar filtros
            </Button>
          </section>
        ) : (
          <EmptyState
            icon={<MapIcon className="h-7 w-7" />}
            title="No tienes viajes registrados"
            description="Crea tu primer viaje para empezar a organizar fechas, actividades y reservas en un solo lugar."
            action={(
              <Link
                href="/trips/new"
                className={`${accentLinkClassName} min-h-11 gap-2`}
              >
                <PlusIcon aria-hidden="true" className="h-4 w-4" />
                Crear primer viaje
              </Link>
            )}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
