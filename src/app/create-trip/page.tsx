"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { selectClassName, textareaClassName } from "@/components/ui/fieldStyles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient } from "@/lib/insforge";
import { queryErrorKind, withQueryTimeout } from "@/lib/insforge-query";
import { CONNECTION_TIMEOUT_MESSAGE } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default function NewTripPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    origin: "",
    destination: "",
    departure_date: "",
    return_date: "",
    airline: "",
    flight_number: "",
    confirmation_number: "",
    notes: "",
    status: "planned" as const,
    travelers: 1,
    budget: 0,
  });

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "travelers" || name === "budget" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    logger.info("Iniciando proceso de creación de viaje");

    if (!user) {
      logger.error("Intento de crear viaje sin usuario autenticado");
      setError("Debes iniciar sesión para crear un viaje");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Validate required fields
      if (
        !formData.title ||
        !formData.origin ||
        !formData.destination ||
        !formData.departure_date
      ) {
        throw new Error("Por favor completa todos los campos requeridos");
      }

      // Validate dates
      const departureDate = new Date(formData.departure_date);
      const returnDate = formData.return_date
        ? new Date(formData.return_date)
        : null;

      if (returnDate && returnDate <= departureDate) {
        throw new Error(
          "La fecha de regreso debe ser posterior a la fecha de salida",
        );
      }

      // Append travelers info to notes
      const notesWithTravelers = formData.notes
        ? `${formData.notes}\n\nViajeros: ${formData.travelers}`
        : `Viajeros: ${formData.travelers}`;

      const newTrip = {
        user_id: user.id,
        title: formData.title,
        origin: formData.origin,
        destination: formData.destination,
        departure_date: formData.departure_date,
        return_date: formData.return_date || null,
        airline: formData.airline || null,
        flight_number: formData.flight_number || null,
        confirmation_number: formData.confirmation_number || null,
        notes: notesWithTravelers || null,
        status: formData.status || "planned",
      };

      logger.debug("Enviando datos al SDK:", newTrip);

      const insforge = createInsforgeClient();
      const { data, error: insertError } = await withQueryTimeout(
        insforge
          .database.from("trips")
          .insert([newTrip])
          .select()
          .single(),
        { label: "trips:insert" },
      );

      if (insertError) throw insertError;

      logger.info("Viaje creado exitosamente:", data.id);

      // Create budget if provided
      if (formData.budget > 0) {
        logger.info("Creando presupuesto inicial para el viaje");
        // Si falla el presupuesto, el viaje ya está creado: el fallo se registra
        // y la navegación sigue igual.
        try {
          const { error: budgetError } = await withQueryTimeout(
            insforge
              .database.from("budgets")
              .insert([
                {
                  user_id: user.id,
                  name: "Presupuesto General",
                  total_amount: formData.budget,
                  currency: "EUR",
                  category: "General",
                  start_date: formData.departure_date.split("T")[0],
                  end_date: formData.return_date
                    ? formData.return_date.split("T")[0]
                    : formData.departure_date.split("T")[0],
                  trip_id: data.id,
                  description: null,
                },
              ])
              .select()
              .single(),
            { label: "trips:budget" },
          );

          if (budgetError) throw budgetError;
        } catch (budgetError) {
          logger.warn("Error al crear presupuesto inicial:", budgetError);
        }
      }

      // Navegación exitosa
      router.push(`/trip?id=${encodeURIComponent(data.id)}`);
    } catch (error: unknown) {
      logger.error("Excepción al crear viaje:", error);

      if (queryErrorKind(error) === "timeout") {
        setError(CONNECTION_TIMEOUT_MESSAGE);
        return;
      }

      let errorMessage = "Error al crear el viaje. Por favor intenta de nuevo.";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (
        typeof error === "object" &&
        error !== null &&
        "message" in error
      ) {
        errorMessage = (error as { message: string }).message;
      }

      setError(errorMessage);
    } finally {
      // Aseguramos que el estado de carga se desactive siempre
      if (document.body.contains(e.target as Node)) {
        setLoading(false);
      } else {
        // Si el componente se desmontó (por navegación exitosa), esto podría no ser necesario,
        // pero lo dejamos por seguridad si la navegación falló o es lenta.
        setLoading(false);
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6 font-sans">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Link
            href="/trips"
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md px-3 text-sm font-medium text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
            Volver a viajes
          </Link>
          <div className="sm:border-l sm:border-line sm:pl-5">
            <h1 className="text-title font-bold tracking-tight text-ink">Nuevo viaje</h1>
            <p className="mt-1 text-sm text-muted">
              Añade las fechas y los detalles que ya tienes. Podrás completar lo demás después.
            </p>
          </div>
        </div>

        {/* Form */}
        <Card className="rounded-xl border border-line bg-paper shadow-sm">
          <CardHeader className="border-b border-line px-5 py-5 sm:px-7">
            <CardTitle className="font-sans text-lg font-semibold text-ink">Información del viaje</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-6 sm:px-7">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div role="alert" className="rounded-lg border border-danger bg-danger/10 px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}

              {/* Basic Information */}
              <div className="space-y-4">
                <h2 className="font-sans text-lg font-semibold text-ink">
                  Información Básica
                </h2>

                <Input
                  label="Título del Viaje *"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="ej. Vacaciones en París"
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Origen *"
                    name="origin"
                    value={formData.origin}
                    onChange={handleInputChange}
                    placeholder="ej. Madrid"
                    required
                  />
                  <Input
                    label="Destino *"
                    name="destination"
                    value={formData.destination}
                    onChange={handleInputChange}
                    placeholder="ej. París"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Fecha de Salida *"
                    name="departure_date"
                    type="datetime-local"
                    value={formData.departure_date}
                    onChange={handleInputChange}
                    required
                  />
                  <Input
                    label="Fecha de Regreso"
                    name="return_date"
                    type="datetime-local"
                    value={formData.return_date}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Número de Personas"
                    name="travelers"
                    type="number"
                    min="1"
                    value={formData.travelers}
                    onChange={handleInputChange}
                    placeholder="1"
                  />
                  <Input
                    label="Presupuesto Estimado (EUR)"
                    name="budget"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.budget}
                    onChange={handleInputChange}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="trip-status" className="block text-sm font-medium text-ink">
                    Estado del viaje
                  </label>
                  <select
                    id="trip-status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className={selectClassName}
                  >
                    <option value="planned">Planeado</option>
                    <option value="confirmed">Confirmado</option>
                  </select>
                </div>
              </div>

              {/* Optional flight details use native disclosure so essentials stay short. */}
              <details className="rounded-xl border border-line bg-surface/50 p-4 sm:p-5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-md text-sm font-semibold text-ink marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                  <span>Añadir datos de vuelo (opcional)</span>
                  <span aria-hidden="true" className="text-accent">＋</span>
                </summary>
                <div className="mt-4 space-y-4 border-t border-line pt-4">
                  <h2 className="font-sans text-base font-semibold text-ink">
                    Información de vuelo
                  </h2>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      label="Aerolínea"
                      name="airline"
                      value={formData.airline}
                      onChange={handleInputChange}
                      placeholder="ej. Iberia"
                    />
                    <Input
                      label="Número de Vuelo"
                      name="flight_number"
                      value={formData.flight_number}
                      onChange={handleInputChange}
                      placeholder="ej. IB3201"
                    />
                  </div>

                  <Input
                    label="Código de Confirmación"
                    name="confirmation_number"
                    value={formData.confirmation_number}
                    onChange={handleInputChange}
                    placeholder="ej. ABC123"
                  />
                </div>
              </details>

              {/* Notes */}
              <div className="space-y-1">
                <label htmlFor="trip-notes" className="block text-sm font-medium text-ink">
                  Notas adicionales
                </label>
                <textarea
                  id="trip-notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={4}
                  className={textareaClassName}
                  placeholder="Añade cualquier información adicional sobre el viaje..."
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
                <Link
                  href="/trips"
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-line px-4 text-sm font-medium text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  Cancelar
                </Link>
                <Button
                  type="submit"
                  loading={loading}
                  className="min-h-11 sm:min-w-40"
                >
                  Crear Viaje
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
