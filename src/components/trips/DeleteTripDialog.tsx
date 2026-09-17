"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import {
  deleteTrip,
  formatTripDeletionCounts,
  getTripDeletionImpact,
  TripChildDeletionError,
  type TripDeletionImpact,
} from "@/lib/trips";
import { queryErrorKind } from "@/lib/insforge-query";
import { logger } from "@/lib/logger";
import { showToast } from "@/lib/toast";
import { CONNECTION_TIMEOUT_MESSAGE, getErrorMessage } from "@/lib/utils";

interface DeleteTripDialogProps {
  trip: { id: string; title: string };
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

type ChildrenChoice = "keep" | "delete";

const optionClassName =
  "flex items-start gap-3 rounded-md border border-line p-3 cursor-pointer hover:bg-surface";

/**
 * Dialogo de borrado de un viaje. Antes de decidir, cuenta con el SDK (RLS
 * manda) lo que se lleva por delante el viaje y lo muestra. Sobre gastos y
 * notas el usuario elige: conservarlos sin viaje (por defecto, no se pierde
 * nada) o borrarlos tambien. Cancelar no borra nada.
 */
export default function DeleteTripDialog({
  trip,
  isOpen,
  onClose,
  onDeleted,
}: DeleteTripDialogProps) {
  const [impact, setImpact] = useState<TripDeletionImpact | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [choice, setChoice] = useState<ChildrenChoice>("keep");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setImpact(null);
    setChoice("keep");
    setLoadingImpact(true);

    getTripDeletionImpact(trip.id)
      .then((result) => {
        if (active) setImpact(result);
      })
      .catch((error) => {
        // Sin conteos el dialogo sigue sirviendo: avisa de lo que se sabe y deja
        // la opcion que no pierde nada.
        logger.warn("DeleteTripDialog: no se pudo contar lo que se borra", error);
      })
      .finally(() => {
        if (active) setLoadingImpact(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, trip.id]);

  const cascadeSummary = impact
    ? formatTripDeletionCounts(impact.cascading)
    : null;
  const optionalSummary = impact
    ? formatTripDeletionCounts([impact.expenses, impact.notes])
    : null;
  const expensesCount = impact?.expenses.count ?? 0;
  const notesCount = impact?.notes.count ?? 0;
  const hasOptional = expensesCount > 0 || notesCount > 0;
  const deleteChildren = hasOptional && choice === "delete";

  const handleConfirm = async () => {
    setDeleting(true);

    try {
      await deleteTrip(trip.id, {
        // Solo se pide borrar la tabla que de verdad tiene filas: pedir un
        // borrado sobre cero filas abortaria el viaje sin motivo.
        deleteExpenses: deleteChildren && expensesCount > 0,
        deleteNotes: deleteChildren && notesCount > 0,
      });
      showToast({ type: "success", message: "Viaje eliminado" });
      onClose();
      onDeleted();
    } catch (err) {
      const message =
        err instanceof TripChildDeletionError
          ? err.message
          : queryErrorKind(err) === "timeout"
            ? CONNECTION_TIMEOUT_MESSAGE
            : getErrorMessage(err, "No se pudo eliminar el viaje");

      logger.error("DeleteTripDialog: delete failed", { error: message });
      showToast({ type: "error", title: "Error al eliminar el viaje", message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Eliminar viaje">
      <div className="space-y-4">
        <p className="text-sm text-ink">
          ¿Seguro que quieres eliminar el viaje &quot;{trip.title}&quot;?
        </p>

        {loadingImpact ? (
          <p className="text-sm text-muted" role="status">
            Calculando qué se borrará…
          </p>
        ) : cascadeSummary ? (
          <p className="text-sm text-ink">
            Se eliminarán también {cascadeSummary}.
          </p>
        ) : (
          <p className="text-sm text-muted">
            No hay más datos asociados a este viaje.
          </p>
        )}

        {hasOptional && optionalSummary && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">
              Gastos y notas
            </legend>
            <p className="text-sm text-muted">
              Este viaje tiene {optionalSummary}. ¿Qué quieres hacer con ellos?
            </p>

            <label className={optionClassName}>
              <input
                type="radio"
                name="trip-children"
                value="keep"
                checked={choice === "keep"}
                onChange={() => setChoice("keep")}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-ink">
                  Conservarlos sin viaje
                </span>
                <span className="block text-xs text-muted">
                  Se quedan sin viaje y puedes asignarlos a otro.
                </span>
              </span>
            </label>

            <label className={optionClassName}>
              <input
                type="radio"
                name="trip-children"
                value="delete"
                checked={choice === "delete"}
                onChange={() => setChoice("delete")}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-ink">
                  Eliminarlos también
                </span>
                <span className="block text-xs text-muted">
                  Se borran junto con el viaje y no se pueden recuperar.
                </span>
              </span>
            </label>
          </fieldset>
        )}

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={deleting}
            disabled={loadingImpact}
            onClick={handleConfirm}
          >
            Eliminar viaje
          </Button>
        </div>
      </div>
    </Modal>
  );
}
