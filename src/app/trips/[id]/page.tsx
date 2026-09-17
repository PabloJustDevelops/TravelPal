"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Button from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient, Trip } from "@/lib/insforge";
import { assertRowsAffected } from "@/lib/insforge-query";
import { logger } from "@/lib/logger";
import { showToast } from "@/lib/toast";
import { getErrorMessage } from "@/lib/utils";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EditTripModal from "@/components/trips/EditTripModal";
import TripJournal from "@/components/trips/TripJournal";
import TripSummary from "@/components/trips/TripSummary";
import {
  ArrowLeftIcon,
  CalendarIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";

export default function TripDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Unwrap params using React.use()
  const { id } = use(params);

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);

  const loadTrip = useCallback(async () => {
    try {
      // Don't set loading to true here to avoid full page spinner on refresh
      // setLoading(true); 
      const insforge = createInsforgeClient();

      const { data, error } = await insforge
        .database.from("trips")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error("Viaje no encontrado");
      }

      setTrip(data);
    } catch (err: unknown) {
      logger.error("Error loading trip details:", err);
      setError("No se pudo cargar la información del viaje");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/signin");
      return;
    }

    setLoading(true);
    loadTrip();
  }, [id, user, authLoading, router, loadTrip]);

  if (loading || authLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center min-h-[50vh]">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !trip) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-600 mb-6">{error || "Viaje no encontrado"}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => {
                setError("");
                setLoading(true);
                loadTrip();
              }}
            >
              Reintentar
            </Button>
            <Link href="/trips">
              <Button variant="outline">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Volver a Mis Viajes
              </Button>
            </Link>
          </div>
        </div>
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
      const { data: updatedRows, error: updateError } = await insforge.database
        .from("trips")
        .update({ status: "completed" })
        .eq("id", trip.id)
        .select();

      if (updateError) throw updateError;
      assertRowsAffected(updatedRows, "No se pudo marcar el viaje como completado");
      await loadTrip();
    } catch (err) {
      const message = getErrorMessage(
        err,
        "No se pudo marcar el viaje como completado",
      );
      logger.error("TripDetailsPage: mark completed failed", { error: message });
      showToast({
        type: "error",
        title: "Error al completar el viaje",
        message,
      });
    } finally {
      setMarkingComplete(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/trips" className="text-gray-500 hover:text-gray-700">
              <ArrowLeftIcon className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{trip.title}</h1>
              <div className="flex items-center text-sm text-gray-500 mt-1">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                    trip.status === "confirmed"
                      ? "bg-green-100 text-green-800"
                      : trip.status === "completed"
                        ? "bg-blue-100 text-blue-800"
                        : trip.status === "cancelled"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {trip.status}
                </span>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(true)}
            >
              Editar
            </Button>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Detalles del Viaje
              </h3>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500 flex items-center">
                    <MapPinIcon className="h-4 w-4 mr-1" />
                    Origen
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">{trip.origin}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500 flex items-center">
                    <MapPinIcon className="h-4 w-4 mr-1" />
                    Destino
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {trip.destination}
                  </dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500 flex items-center">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    Fecha de Salida
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(trip.departure_date).toLocaleDateString()}
                    <span className="block text-xs text-gray-500">
                      {new Date(trip.departure_date).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </dd>
                </div>
                {trip.return_date && (
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500 flex items-center">
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      Fecha de Regreso
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(trip.return_date).toLocaleDateString()}
                      <span className="block text-xs text-gray-500">
                        {new Date(trip.return_date).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Notes Section */}
            {trip.notes && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Notas
                </h3>
                <div className="prose prose-sm max-w-none text-gray-500 whitespace-pre-wrap">
                  {trip.notes}
                </div>
              </div>
            )}

            {/* Diario */}
            {isPast ? (
              <TripJournal tripId={trip.id} />
            ) : (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Diario del viaje
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  El diario se abre cuando el viaje haya pasado. Tambien puedes
                  marcarlo como completado ahora.
                </p>
                <Button onClick={markCompleted} disabled={markingComplete}>
                  {markingComplete ? "Marcando..." : "Marcar como completado"}
                </Button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Resumen */}
            <TripSummary tripId={trip.id} />

            {/* Flight Info */}
            {(trip.airline ||
              trip.flight_number ||
              trip.confirmation_number) && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Información de Vuelo
                </h3>
                <div className="space-y-4">
                  {trip.airline && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Aerolínea
                      </p>
                      <p className="text-sm text-gray-900">{trip.airline}</p>
                    </div>
                  )}
                  {trip.flight_number && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Número de Vuelo
                      </p>
                      <p className="text-sm text-gray-900">
                        {trip.flight_number}
                      </p>
                    </div>
                  )}
                  {trip.confirmation_number && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Confirmación
                      </p>
                      <p className="text-sm font-mono bg-gray-50 p-1 rounded">
                        {trip.confirmation_number}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
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
