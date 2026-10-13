"use client";

import React, { useId, useState } from "react";
import {
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";
import Button from "../ui/Button";
import CategoryIcon from "../ui/CategoryIcon";
import { Card } from "../ui/Card";
import { formatDate } from "../../lib/utils";
import { Booking } from "@/lib/insforge";

interface BookingCardProps {
  booking: Booking;
  onEdit?: (booking: Booking) => void;
  onDelete?: (bookingId: string) => void;
  onStatusChange?: (bookingId: string, status: Booking["status"]) => void;
  className?: string;
}

const BOOKING_TYPES = {
  flight: { label: "Vuelo", category: "flight", color: "bg-accent-soft text-accent" },
  hotel: { label: "Hotel", category: "hotel", color: "bg-surface-strong text-ink" },
  car: { label: "Auto", category: "car", color: "bg-success/10 text-success" },
  activity: {
    label: "Actividad",
    category: "activity",
    color: "bg-warning/10 text-warning",
  },
  restaurant: {
    label: "Restaurante",
    category: "restaurant",
    color: "bg-danger/10 text-danger",
  },
  other: { label: "Otro", category: "other", color: "bg-surface-strong text-muted" },
};

const STATUS_CONFIG = {
  confirmed: {
    label: "Confirmado",
    color: "bg-success/10 text-success",
    icon: CheckCircleIcon,
  },
  pending: {
    label: "Pendiente",
    color: "bg-warning/10 text-warning",
    icon: ClockIcon,
  },
  cancelled: {
    label: "Cancelado",
    color: "bg-danger/10 text-danger",
    icon: ExclamationTriangleIcon,
  },
};

export const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  onEdit,
  onDelete,
  onStatusChange,
  className = "",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsId = useId();

  const bookingType = BOOKING_TYPES[booking.type] || BOOKING_TYPES.other;
  const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  const formatDateRange = () => {
    const start = formatDate(new Date(booking.start_date));
    if (booking.end_date && booking.end_date !== booking.start_date) {
      const end = formatDate(new Date(booking.end_date));
      return `${start} - ${end}`;
    }
    return start;
  };

  const formatTimeRange = () => {
    if (!booking.start_time) return null;
    if (booking.end_time && booking.end_time !== booking.start_time) {
      return `${booking.start_time} - ${booking.end_time}`;
    }
    return booking.start_time;
  };

  return (
    <Card
      className={`overflow-hidden rounded-xl border border-line bg-paper font-sans transition-colors hover:border-accent/40 ${className}`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="shrink-0">
              <CategoryIcon
                category={bookingType.category}
                className="h-6 w-6 text-muted"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
                <h3 className="min-w-0 flex-1 truncate font-sans font-semibold text-ink">
                  {booking.title}
                </h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${bookingType.color}`}
                >
                  {bookingType.label}
                </span>
              </div>
              <p className="mb-2 text-sm text-muted">
                Confirmación:{" "}
                <span className="font-mono font-medium">
                  {booking.confirmation_number || "N/A"}
                </span>
              </p>
              {booking.description && (
                <p className="mb-2 text-sm text-muted">
                  {booking.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto sm:shrink-0 sm:justify-end">
            <div
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium ${statusConfig.color}`}
            >
              <StatusIcon aria-hidden="true" className="h-3 w-3" />
              <span>{statusConfig.label}</span>
            </div>
            {onEdit && (
              <Button
                type="button"
                variant="ghost"
                aria-label={`Editar reserva ${booking.title}`}
                onClick={() => onEdit(booking)}
                className="min-h-11 min-w-11 p-0"
              >
                <PencilIcon aria-hidden="true" className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                type="button"
                aria-label={`Eliminar reserva ${booking.title}`}
                onClick={() => onDelete(booking.id)}
                className="min-h-11 min-w-11 p-0 text-danger hover:bg-danger/10 hover:text-danger"
              >
                <TrashIcon aria-hidden="true" className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Información básica */}
        <div className="mb-4 grid grid-cols-1 gap-3 text-sm text-muted sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <CalendarIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{formatDateRange()}</span>
          </div>

          {formatTimeRange() && (
            <div className="flex items-center gap-2">
              <ClockIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{formatTimeRange()}</span>
            </div>
          )}

          {booking.location && (
            <div className="flex items-center gap-2">
              <MapPinIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{booking.location}</span>
            </div>
          )}

          {booking.cost && (
            <div className="text-sm font-medium text-ink">
              {booking.cost} {booking.currency || "USD"}
            </div>
          )}
        </div>

        {/* Botón para expandir detalles */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            className="min-h-11 px-3 text-accent hover:bg-accent-soft hover:text-accent"
          >
            {isExpanded ? "Ocultar detalles" : "Ver detalles"}
          </Button>

          {onStatusChange && booking.status !== "confirmed" && (
            <div className="flex flex-wrap gap-2">
              {booking.status === "pending" && (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => onStatusChange(booking.id, "confirmed")}
                  className="min-h-11 border-success text-success hover:bg-success/10"
                >
                  Confirmar
                </Button>
              )}
              <Button
                variant="outline"
                type="button"
                onClick={() => onStatusChange(booking.id, "cancelled")}
                className="min-h-11 border-danger text-danger hover:bg-danger/10"
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>

        {/* Detalles expandidos */}
        {isExpanded && (
          <div id={detailsId} role="region" aria-label={`Detalles de ${booking.title}`} className="mt-4 space-y-4 border-t border-line pt-4">
            {/* Dirección */}
            {booking.address && (
              <div>
                <h4 className="mb-1 font-sans text-sm font-semibold text-ink">
                  Dirección
                </h4>
                <p className="text-sm text-muted">{booking.address}</p>
              </div>
            )}

            {/* Información de contacto */}
            {(booking.contact_name ||
              booking.contact_phone ||
              booking.contact_email) && (
              <div>
                <h4 className="mb-2 font-sans text-sm font-semibold text-ink">
                  Contacto
                </h4>
                <div className="space-y-1">
                  {booking.contact_name && (
                    <div className="flex items-center gap-2 text-sm text-muted">
                      <UserIcon aria-hidden="true" className="h-4 w-4" />
                      <span>{booking.contact_name}</span>
                    </div>
                  )}
                  {booking.contact_phone && (
                    <div className="flex items-center gap-2 text-sm text-muted">
                      <PhoneIcon aria-hidden="true" className="h-4 w-4" />
                      <a
                        href={`tel:${booking.contact_phone}`}
                        className="inline-flex min-h-11 items-center text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {booking.contact_phone}
                      </a>
                    </div>
                  )}
                  {booking.contact_email && (
                    <div className="flex items-center gap-2 text-sm text-muted">
                      <EnvelopeIcon aria-hidden="true" className="h-4 w-4" />
                      <a
                        href={`mailto:${booking.contact_email}`}
                        className="inline-flex min-h-11 items-center text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {booking.contact_email}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notas */}
            {booking.notes && (
              <div>
                <h4 className="mb-1 font-sans text-sm font-semibold text-ink">
                  Notas
                </h4>
                <p className="whitespace-pre-wrap text-sm text-muted">
                  {booking.notes}
                </p>
              </div>
            )}

            {/* Documentos */}
            {booking.documents && booking.documents.length > 0 && (
              <div>
                <h4 className="mb-2 font-sans text-sm font-semibold text-ink">
                  Documentos
                </h4>
                <div className="space-y-1">
                  {booking.documents.map((doc, index) => (
                    <div
                      key={index}
                      className="text-sm text-accent hover:underline"
                    >
                      <a href={doc} target="_blank" rel="noopener noreferrer">
                        Documento {index + 1}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
