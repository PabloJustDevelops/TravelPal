
import React, { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import Input from "../ui/Input";
import { selectClassName, textareaClassName } from "../ui/fieldStyles";
import Button from "../ui/Button";
import { createInsforgeClient, Trip } from "@/lib/insforge";
import {
  assertRowsAffected,
  queryErrorKind,
  withQueryTimeout,
} from "@/lib/insforge-query";
import { CONNECTION_TIMEOUT_MESSAGE } from "@/lib/utils";
import { logger } from "@/lib/logger";

interface EditTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  trip: Trip;
}

export default function EditTripModal({
  isOpen,
  onClose,
  onSuccess,
  trip,
}: EditTripModalProps) {
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
    status: "planned",
  });

  useEffect(() => {
    if (trip) {
      setFormData({
        title: trip.title || "",
        origin: trip.origin || "",
        destination: trip.destination || "",
        departure_date: trip.departure_date ? new Date(trip.departure_date).toISOString().slice(0, 16) : "",
        return_date: trip.return_date ? new Date(trip.return_date).toISOString().slice(0, 16) : "",
        airline: trip.airline || "",
        flight_number: trip.flight_number || "",
        confirmation_number: trip.confirmation_number || "",
        notes: trip.notes || "",
        status: trip.status || "planned",
      });
    }
  }, [trip]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const insforge = createInsforgeClient();

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
          "La fecha de regreso debe ser posterior a la fecha de salida"
        );
      }

      const tripData = {
        title: formData.title,
        origin: formData.origin,
        destination: formData.destination,
        departure_date: formData.departure_date,
        return_date: formData.return_date || null,
        airline: formData.airline || null,
        flight_number: formData.flight_number || null,
        confirmation_number: formData.confirmation_number || null,
        notes: formData.notes,
        status: formData.status,
      };

      const { data: updatedRows, error } = await withQueryTimeout(
        insforge
          .database.from("trips")
          .update(tripData)
          .eq("id", trip.id)
          .select(),
        { label: "trips:update" },
      );

      if (error) throw error;
      assertRowsAffected(updatedRows, "No se pudo actualizar el viaje");

      logger.info("Viaje actualizado exitosamente:", trip.id);
      onSuccess();
      onClose();
    } catch (error: any) {
      logger.error("Error al actualizar viaje:", error);
      setError(
        queryErrorKind(error) === "timeout"
          ? CONNECTION_TIMEOUT_MESSAGE
          : error.message || "Error al actualizar el viaje",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Viaje" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900 border-b pb-2">
            Información Básica
          </h3>

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

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Estado del Viaje
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className={selectClassName}
            >
              <option value="planned">Planeado</option>
              <option value="confirmed">Confirmado</option>
              <option value="completed">Completado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>

        {/* Flight Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900 border-b pb-2">
            Información de Vuelo
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        {/* Notes */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Notas Adicionales
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={4}
            className={textareaClassName}
            placeholder="Añade cualquier información adicional sobre el viaje..."
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button
            type="submit"
            disabled={loading}
            className="flex-1 sm:flex-none"
          >
            {loading ? "Guardando..." : "Guardar Cambios"}
          </Button>
          <Button 
            variant="outline" 
            type="button" 
            onClick={onClose}
            className="flex-1 sm:flex-none"
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
