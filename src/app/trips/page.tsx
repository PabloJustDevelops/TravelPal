"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Button from "@/components/ui/Button";
import PageTitle from "@/components/ui/PageTitle";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import { selectClassName } from "@/components/ui/fieldStyles";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient, Trip } from "@/lib/insforge";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  MapIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/utils";

export default function TripsPage() {
  const { user, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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
    setLoadError(false);

    (async () => {
      try {
        const insforge = createInsforgeClient();
        const { data, error } = await insforge
          .database.from("trips")
          .select("*")
          .eq("user_id", userId)
          .order("departure_date", { ascending: false });

        if (error) throw error;

        if (!active) return;
        setTrips((data as Trip[]) ?? []);
      } catch (err) {
        if (!active) return;
        logger.error("TripsPage: Error loading trips", {
          error: getErrorMessage(err, "Error al cargar los viajes"),
        });
        setLoadError(true);
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

  const error = loadError
    ? "Error al cargar los viajes. Por favor, intenta recargar."
    : null;

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
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold text-ink">
            Inicia sesión para ver tus viajes
          </h3>
          <p className="mt-1 text-sm text-muted">
            La sección de viajes requiere autenticación.
          </p>
          <Link href="/signin">
            <Button className="mt-4">Ir a Login</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageTitle
          title="Mis Viajes"
          subtitle="Gestiona tus itinerarios y reservas"
          action={
            <Link href="/trips/new">
              <Button>
                <PlusIcon className="h-4 w-4 mr-2" />
                Nuevo Viaje
              </Button>
            </Link>
          }
        />

        {/* Filters */}
        <div className="bg-surface p-4 rounded-lg shadow-sm border border-line">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
                <Input
                  type="text"
                  placeholder="Buscar viajes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="lg:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={selectClassName}
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
        </div>

        {/* Error State */}
        {error ? (
          <div className="bg-danger/10 border border-danger rounded-lg p-4 flex flex-col items-center justify-center text-danger mb-6">
            <p className="font-medium mb-2">Hubo un problema al cargar tus viajes</p>
            <p className="text-sm mb-4">{error}</p>
            <Button 
              onClick={() => {
                refetch();
              }}
              variant="outline"
              className="bg-surface hover:bg-surface-strong text-danger border-danger"
            >
              Reintentar
            </Button>
          </div>
        ) : filteredTrips.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrips.map((trip) => (
              <div
                key={trip.id}
                className="bg-surface rounded-lg shadow-sm border border-line p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-ink">
                      {trip.title}
                    </h3>
                    <p className="text-sm text-muted">
                      {trip.origin} → {trip.destination}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                    trip.status === 'confirmed' ? 'bg-success/10 text-success' :
                    trip.status === 'cancelled' ? 'bg-danger/10 text-danger' :
                    trip.status === 'completed' ? 'bg-accent-soft text-accent' :
                    'bg-warning/10 text-warning'
                  }`}>
                    {trip.status}
                  </span>
                </div>
                <div className="mt-4 text-sm text-muted">
                  <div>
                    Salida: {new Date(trip.departure_date).toLocaleDateString()}
                  </div>
                  {trip.return_date && (
                    <div>
                      Regreso: {new Date(trip.return_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Link
                    href={`/trips/${trip.id}`}
                    className="text-accent hover:text-accent-hover text-sm font-medium"
                  >
                    Ver detalles
                  </Link>
                  <div className="flex items-center text-muted">
                    <PlayIcon className="h-5 w-5 mr-1" />
                    {trip.airline || "Sin aerolínea"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<MapIcon className="h-12 w-12" />}
            title="No tienes viajes registrados"
            description="Crea tu primer viaje para empezar a planificar."
            action={
              <Link href="/trips/new">
                <Button>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Crear Primer Viaje
                </Button>
              </Link>
            }
          />
        )}
      </div>
    </DashboardLayout>
  );
}
