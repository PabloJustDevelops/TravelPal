import React, { useState, useEffect } from "react";
import Input from "../ui/Input";
import { selectClassName } from "../ui/fieldStyles";
import Button from "../ui/Button";
import { Booking, createInsforgeClient } from "@/lib/insforge";
import { assertRowsAffected } from "@/lib/insforge-query";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/utils";

interface NewBookingFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: Booking | null;
  defaultDate?: Date;
}

export default function NewBookingForm({
  onSuccess,
  onCancel,
  initialData,
  defaultDate,
}: NewBookingFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [trips, setTrips] = useState<{id: string, title: string}[]>([]);

  useEffect(() => {
      // Cargar viajes para el selector si es una nueva reserva
      if (initialData || !user?.id) return;

      let active = true;
      const userId = user.id;

      const fetchTrips = async () => {
          try {
              const insforge = createInsforgeClient();
              const { data, error } = await insforge
                  .database.from("trips")
                  .select("*")
                  .eq("user_id", userId)
                  .order("departure_date", { ascending: false });

              if (error) throw error;
              if (!active) return;

              const tripsData = (data as { id: string; title: string }[]) ?? [];
              setTrips(tripsData);
              // Preseleccionar el primer viaje si existe
              if (tripsData.length > 0) {
                  setFormData(prev => ({ ...prev, trip_id: tripsData[0].id }));
              }
          } catch (e) {
              logger.error("Error fetching trips for selector", e);
          }
      };
      fetchTrips();

      return () => {
          active = false;
      };
  }, [initialData, user?.id]);

  const [formData, setFormData] = useState({
    title: "",
    type: "other",
    start_date: defaultDate 
      ? defaultDate.toISOString().split("T")[0] 
      : new Date().toISOString().split("T")[0],
    start_time: "12:00",
    number_of_people: 1,
    description: "",
    trip_id: "",
    airline: "",
    flight_number: "",
    origin: "",
    destination: "",
    cost: "",
    currency: "EUR",
  });

  useEffect(() => {
    if (initialData) {
      // Extract number of people from notes if possible
      let people = 1;
      let desc = initialData.description || "";
      
      if (initialData.notes) {
        const peopleMatch = initialData.notes.match(/Personas: (\d+)/);
        if (peopleMatch) {
          people = parseInt(peopleMatch[1], 10);
        }
        // Remove the "Personas: X" part from description if it was added there
        desc = initialData.notes.replace(/Personas: \d+\n?/, "").trim();
      }

      setFormData({
        title: initialData.title,
        type: initialData.type,
        start_date: initialData.start_date,
        start_time: initialData.start_time || "12:00",
        number_of_people: people,
        description: desc,
        trip_id: initialData.trip_id || "",
        airline: initialData.airline || "",
        flight_number: initialData.flight_number || "",
        origin: initialData.origin || "",
        destination: initialData.destination || "",
        cost:
          initialData.cost === undefined || initialData.cost === null
            ? ""
            : String(initialData.cost),
        currency: initialData.currency || "EUR",
      });
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      // El handler borrado envolvia el numero de personas y la descripcion en
      // `notes` y aplicaba sus defaults al construir la fila: opcionales vacios
      // a null, `cost` a 0 y `currency` a EUR. Se reproduce tal cual.
      const notes = `Personas: ${formData.number_of_people}\n${formData.description}`;
      const startTime = formData.start_time || null;
      const status = initialData ? initialData.status : "confirmed";

      const flightFields =
        formData.type === "flight"
          ? {
              airline: formData.airline || null,
              flight_number: formData.flight_number || null,
              origin: formData.origin || null,
              destination: formData.destination || null,
              cost: formData.cost === "" ? 0 : Number(formData.cost),
              currency: formData.currency || "EUR",
            }
          : null;

      const insforge = createInsforgeClient();

      if (initialData) {
        const { data: updatedRows, error } = await insforge
          .database.from("bookings")
          .update({
            type: formData.type,
            title: formData.title,
            description: formData.description || null,
            start_date: formData.start_date,
            start_time: startTime,
            end_date: null,
            end_time: null,
            location: null,
            confirmation_number: null,
            airline: flightFields?.airline || null,
            flight_number: flightFields?.flight_number || null,
            origin: flightFields?.origin || null,
            destination: flightFields?.destination || null,
            cost: flightFields?.cost || 0,
            currency: flightFields?.currency || "EUR",
            status: status || "pending",
            notes: notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", initialData.id)
          .eq("user_id", user.id)
          .select();

        if (error) throw error;
        assertRowsAffected(updatedRows, "No se pudo guardar la reserva");
      } else {
        const { error } = await insforge
          .database.from("bookings")
          .insert([
            {
              user_id: user.id,
              trip_id: formData.trip_id,
              type: formData.type,
              title: formData.title,
              description: formData.description || null,
              start_date: formData.start_date,
              start_time: startTime,
              end_date: null,
              end_time: null,
              location: null,
              confirmation_number: null,
              airline: flightFields?.airline || null,
              flight_number: flightFields?.flight_number || null,
              origin: flightFields?.origin || null,
              destination: flightFields?.destination || null,
              cost: flightFields?.cost || 0,
              currency: flightFields?.currency || "EUR",
              status: status || "pending",
              notes: notes || null,
            },
          ])
          .select()
          .single();

        if (error) throw error;
      }

      logger.info(`Booking ${initialData ? "updated" : "created"} successfully`);
      onSuccess();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Error al guardar la reserva");
      logger.error("Error saving booking:", { error: message, raw: err });
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          label="Título *"
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="Ej: Cena en Restaurante X"
          required
        />
      </div>

      {!initialData && (
          <div>
              <label className="block text-sm font-medium text-muted mb-1">
                  Viaje Asociado *
              </label>
              <select
                  name="trip_id"
                  value={formData.trip_id}
                  onChange={handleChange}
                  className={selectClassName}
                  required
              >
                  <option value="">Selecciona un viaje</option>
                  {trips.map(trip => (
                      <option key={trip.id} value={trip.id}>{trip.title}</option>
                  ))}
              </select>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="type-select"
            className="block text-sm font-medium text-muted mb-1"
          >
            Tipo
          </label>
          <select
            id="type-select"
            name="type"
            value={formData.type}
            onChange={handleChange}
            className={selectClassName}
          >
            <option value="flight">Vuelo</option>
            <option value="hotel">Hotel</option>
            <option value="car">Coche</option>
            <option value="restaurant">Restaurante</option>
            <option value="activity">Actividad</option>
            <option value="other">Otro</option>
          </select>
        </div>

        <div>
          <Input
            label="Nº Personas"
            type="number"
            name="number_of_people"
            value={formData.number_of_people}
            onChange={handleChange}
            min={1}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Input
            label="Fecha *"
            type="date"
            name="start_date"
            value={formData.start_date}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <Input
            label="Hora"
            type="time"
            name="start_time"
            value={formData.start_time}
            onChange={handleChange}
          />
        </div>
      </div>

      {formData.type === "flight" && (
        <div className="space-y-4 rounded-md border border-line p-4">
          <h4 className="text-sm font-semibold text-ink">
            Datos del vuelo
          </h4>

          <Input
            label="Aerolínea"
            name="airline"
            value={formData.airline}
            onChange={handleChange}
            placeholder="ej. Iberia"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nº de vuelo"
              name="flight_number"
              value={formData.flight_number}
              onChange={handleChange}
              placeholder="ej. IB3201"
            />
            <Input
              label="Precio"
              type="number"
              min={0}
              step="0.01"
              name="cost"
              value={formData.cost}
              onChange={handleChange}
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Origen"
              name="origin"
              value={formData.origin}
              onChange={handleChange}
              placeholder="ej. MAD"
            />
            <Input
              label="Destino"
              name="destination"
              value={formData.destination}
              onChange={handleChange}
              placeholder="ej. JFK"
            />
          </div>

          <div>
            <label
              htmlFor="currency-select"
              className="block text-sm font-medium text-muted mb-1"
            >
              Moneda
            </label>
            <select
              id="currency-select"
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              className={selectClassName}
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>
      )}

      {error && (
        <div className="text-danger text-sm bg-danger/10 p-2 rounded">
          {error}
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-4">
        <Button variant="outline" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : "Guardar Reserva"}
        </Button>
      </div>
    </form>
  );
}
