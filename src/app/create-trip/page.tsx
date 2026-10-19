"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { selectClassName, textareaClassName } from "@/components/ui/fieldStyles";
import PageTitle from "@/components/ui/PageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient } from "@/lib/insforge";
import { queryErrorKind, withQueryTimeout } from "@/lib/insforge-query";
import { CONNECTION_TIMEOUT_MESSAGE } from "@/lib/utils";
import { logger } from "@/lib/logger";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  MapPinIcon,
  PlusIcon,
  UsersIcon,
  CurrencyEuroIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";

function formatPreviewDate(value: string) {
  if (!value) return "Por definir";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Por definir";
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPreviewBudget(amount: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount || 0);
}

function NewTripForm() {
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const keys = ["source", "origin", "destination", "departure", "return"];
    if ([...params.keys()].some((key) => !keys.includes(key))) return;
    if (keys.some((key) => params.getAll(key).length > 1)) return;
    if (params.get("source") !== "inspiration") return;

    const origin = params.get("origin") ?? "";
    const destination = params.get("destination") ?? "";
    const departure = params.get("departure") ?? "";
    const returnDate = params.get("return") ?? "";
    const validDay = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
    };
    const today = new Date().toISOString().slice(0, 10);
    if (
      !/^[A-Z]{3}$/.test(origin) ||
      !/^[A-Z]{3}$/.test(destination) ||
      origin === destination ||
      !validDay(departure) ||
      departure <= today ||
      (returnDate && (!validDay(returnDate) || returnDate <= departure))
    ) return;

    setFormData((previous) => ({
      ...previous,
      title: `Viaje a ${destination}`,
      origin,
      destination,
      departure_date: `${departure}T09:00`,
      return_date: returnDate ? `${returnDate}T09:00` : "",
    }));
  }, []);

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
      <div className="mx-auto max-w-7xl space-y-7 font-sans">
        <div className="space-y-2">
          <Link
            href="/trips"
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md px-3 text-sm font-medium text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
            Volver a viajes
          </Link>
          <PageTitle
            title="Dale forma a tu próximo viaje."
            subtitle="Empieza por lo que ya sabes. El resto puede esperar."
          />
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.8fr)]"
        >
          <div className="min-w-0 space-y-5">
              {error && (
                <div role="alert" className="rounded-lg border border-danger bg-danger/10 px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}

              <section className="space-y-4 border-b border-line pb-5" aria-labelledby="trip-destination-heading">
                <h2 id="trip-destination-heading" className="font-sans text-xl font-semibold text-ink">
                  Destino y fechas
                </h2>

                <Input
                  label="Título del Viaje *"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="ej. Un fin de semana en Lisboa"
                  className="min-h-11"
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Origen *" name="origin" value={formData.origin} onChange={handleInputChange} placeholder="ej. Madrid" className="min-h-11" required />
                  <Input label="Destino *" name="destination" value={formData.destination} onChange={handleInputChange} placeholder="ej. Lisboa" className="min-h-11" required />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Fecha de Salida *" name="departure_date" type="datetime-local" value={formData.departure_date} onChange={handleInputChange} className="min-h-11" required />
                  <Input label="Fecha de Regreso" name="return_date" type="datetime-local" value={formData.return_date} onChange={handleInputChange} className="min-h-11" />
                </div>
              </section>

              <section className="space-y-5" aria-labelledby="trip-details-heading">
                <h2 id="trip-details-heading" className="font-sans text-xl font-semibold text-ink">
                  Un par de detalles
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Número de Personas"
                    name="travelers"
                    type="number"
                    min="1"
                    value={formData.travelers}
                    onChange={handleInputChange}
                    placeholder="1"
                    className="min-h-11"
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
                    className="min-h-11"
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
                    className={`${selectClassName} min-h-11`}
                  >
                    <option value="planned">Planeado</option>
                    <option value="confirmed">Confirmado</option>
                  </select>
                </div>

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
              </section>

              <details className="rounded-lg border border-line bg-paper p-4 sm:p-5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-md text-sm font-semibold text-ink marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                  <span>Añadir datos de vuelo (opcional)</span>
                  <PlusIcon aria-hidden="true" className="h-5 w-5 text-accent" />
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
                      className="min-h-11"
                    />
                    <Input
                      label="Número de Vuelo"
                      name="flight_number"
                      value={formData.flight_number}
                      onChange={handleInputChange}
                      placeholder="ej. IB3201"
                      className="min-h-11"
                    />
                  </div>

                  <Input
                    label="Código de Confirmación"
                    name="confirmation_number"
                    value={formData.confirmation_number}
                    onChange={handleInputChange}
                    placeholder="ej. ABC123"
                    className="min-h-11"
                  />
                </div>
              </details>

          </div>

          <aside className="min-w-0 border-t border-line pt-6 lg:sticky lg:top-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0" aria-label="Resumen del viaje">
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-ink">Así empieza tu viaje</h2>
              <p className="flex items-start gap-3 text-lg font-semibold text-ink">
                <MapPinIcon className="mt-0.5 h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
                <span>{formData.title.trim() || "Tu próximo viaje"}</span>
              </p>
              <dl className="space-y-4 text-sm text-muted">
                <div className="flex items-start gap-3">
                  <MapPinIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <dd>{formData.origin || "Origen"} <span aria-hidden="true">→</span> {formData.destination || "Destino"}</dd>
                </div>
                <div className="flex items-start gap-3">
                  <CalendarDaysIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <dd>
                    {formatPreviewDate(formData.departure_date)}
                    {formData.return_date && <> – {formatPreviewDate(formData.return_date)}</>}
                  </dd>
                </div>
                <div className="flex items-center gap-3">
                  <UsersIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <dd>{formData.travelers} {formData.travelers === 1 ? "persona" : "personas"}</dd>
                </div>
                <div className="flex items-center gap-3">
                  <CurrencyEuroIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <dd>{formatPreviewBudget(formData.budget)}</dd>
                </div>
              </dl>
              <p className="border-t border-line pt-4 text-sm leading-reading text-muted">
                Al crearlo podrás añadir el itinerario y tus reservas. Las notas quedan guardadas con el viaje.
              </p>
            </div>
          </aside>

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end lg:col-start-1">
            <Link href="/trips" className="inline-flex min-h-11 items-center justify-center rounded-md border border-line px-4 text-sm font-medium text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
              Cancelar
            </Link>
            <Button type="submit" loading={loading} className="min-h-11 sm:min-w-40">
              Crear Viaje
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

export default NewTripForm;
