
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

import { logger } from "@/lib/logger";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  const { t } = useI18n();
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
    travelers: 1,
  });

  useEffect(() => {
    if (trip) {
      const savedNotes = trip.notes || "";
      const travelersMatch = savedNotes.match(/(?:\n\n)?Viajeros:\s*(\d+)\s*$/);
      setFormData({
        title: trip.title || "",
        origin: trip.origin || "",
        destination: trip.destination || "",
        departure_date: trip.departure_date ? new Date(trip.departure_date).toISOString().slice(0, 16) : "",
        return_date: trip.return_date ? new Date(trip.return_date).toISOString().slice(0, 16) : "",
        airline: trip.airline || "",
        flight_number: trip.flight_number || "",
        confirmation_number: trip.confirmation_number || "",
        notes: travelersMatch
          ? savedNotes.replace(/(?:\n\n)?Viajeros:\s*\d+\s*$/, "").trimEnd()
          : savedNotes,
        status: trip.status || "planned",
        travelers: travelersMatch ? Number(travelersMatch[1]) : 1,
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
      [name]: name === "travelers" ? Number(value) : value,
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
        throw new Error(t("requiredFieldsError"));
      }

      // Validate dates
      const departureDate = new Date(formData.departure_date);
      const returnDate = formData.return_date
        ? new Date(formData.return_date)
        : null;

      if (returnDate && returnDate <= departureDate) {
        throw new Error(
          t("returnDateError")
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
        notes: formData.notes.trim()
          ? `${formData.notes.trim()}\n\nViajeros: ${formData.travelers}`
          : `Viajeros: ${formData.travelers}`,
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
      assertRowsAffected(updatedRows, t("tripUpdateError"));

      logger.info("Viaje actualizado exitosamente:", trip.id);
      onSuccess();
      onClose();
    } catch (error: any) {
      logger.error("Error al actualizar viaje:", error);
      setError(
        queryErrorKind(error) === "timeout"
          ? t("connectionTimeout")
          : error.message || t("tripUpdateError"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("editTripFormTitle")} size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div role="alert" className="rounded-md border border-danger bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="border-b border-line pb-2 text-base font-semibold text-ink">
            {t("destinationAndDates")}
          </h3>

          <Input
            label={t("tripTitleLabel")}
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder={t("titlePlaceholder")}
            className="min-h-11"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t("originLabel")}
              name="origin"
              value={formData.origin}
              onChange={handleInputChange}
              placeholder={t("originPlaceholder")}
              className="min-h-11"
              required
            />
            <Input
              label={t("destinationLabel")}
              name="destination"
              value={formData.destination}
              onChange={handleInputChange}
              placeholder={t("destinationPlaceholder")}
              className="min-h-11"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t("departureDateLabel")}
              name="departure_date"
              type="datetime-local"
              value={formData.departure_date}
              onChange={handleInputChange}
              required
              className="min-h-11"
            />
            <Input
              label={t("returnDateLabel")}
              name="return_date"
              type="datetime-local"
              value={formData.return_date}
              onChange={handleInputChange}
              className="min-h-11"
            />
          </div>

        </div>

        <div className="space-y-4 border-t border-line pt-5">
          <h3 className="text-base font-semibold text-ink">{t("tripDetails")}</h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t("travelers")}
              name="travelers"
              type="number"
              min="1"
              value={formData.travelers}
              onChange={handleInputChange}
              className="min-h-11"
            />
            <div className="space-y-1">
              <label htmlFor="edit-trip-status" className="block text-sm font-medium text-ink">
                {t("editorStatus")}
              </label>
              <select
                id="edit-trip-status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className={`${selectClassName} min-h-11`}
              >
                <option value="planned">{t("tripStatusPlanned")}</option>
                <option value="confirmed">{t("tripStatusConfirmed")}</option>
                <option value="completed">{t("tripStatusCompleted")}</option>
                <option value="cancelled">{t("tripStatusCancelled")}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Flight Information */}
        <div className="space-y-4 border-t border-line pt-5">
          <h3 className="text-base font-semibold text-ink">{t("flightInformation")}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t("airline")}
              name="airline"
              value={formData.airline}
              onChange={handleInputChange}
              placeholder={t("airlinePlaceholder")}
              className="min-h-11"
            />
            <Input
              label={t("flightNumber")}
              name="flight_number"
              value={formData.flight_number}
              onChange={handleInputChange}
              placeholder={t("flightNumberPlaceholder")}
              className="min-h-11"
            />
          </div>

          <Input
            label={t("confirmation")}
            name="confirmation_number"
            value={formData.confirmation_number}
            onChange={handleInputChange}
            placeholder={t("confirmationPlaceholder")}
            className="min-h-11"
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label htmlFor="edit-trip-notes" className="block text-sm font-medium text-ink">
            {t("extraNotes")}
          </label>
          <textarea
            id="edit-trip-notes"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={4}
            className={textareaClassName}
            placeholder={t("extraNotesPlaceholder")}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-line">
          <Button
            type="submit"
            disabled={loading}
            className="min-h-11 flex-1 sm:flex-none"
          >
            {loading ? t("saving") : t("saveChanges")}
          </Button>
          <Button 
            variant="outline" 
            type="button" 
            onClick={onClose}
            className="min-h-11 flex-1 sm:flex-none"
          >
            {t("cancel")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
