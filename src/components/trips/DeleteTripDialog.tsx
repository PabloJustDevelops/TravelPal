"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import {
  deleteTrip,
  getTripDeletionImpact,
  TripChildDeletionError,
  type TripDeletionImpact,
} from "@/lib/trips";
import { queryErrorKind } from "@/lib/insforge-query";
import { logger } from "@/lib/logger";
import { showToast } from "@/lib/toast";
import { getErrorMessage } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  const { locale, t } = useI18n();
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

  const formatCounts = (counts: TripDeletionImpact["cascading"]) => {
    const keyByTable = {
      itinerary_activities: ["deletionCountActivitiesOne", "deletionCountActivitiesMany"],
      bookings: ["deletionCountBookingOne", "deletionCountBookingMany"],
      journal_entries: ["deletionCountJournalEntryOne", "deletionCountJournalEntryMany"],
      journal_photos: ["deletionCountJournalPhotoOne", "deletionCountJournalPhotoMany"],
      expenses: ["deletionCountExpenseOne", "deletionCountExpenseMany"],
      notes: ["deletionCountNoteOne", "deletionCountNoteMany"],
    } as const;
    const parts = counts.filter((entry) => entry.count > 0).map((entry) => {
      const keys = keyByTable[entry.table as keyof typeof keyByTable];
      const label = keys ? t(entry.count === 1 ? keys[0] : keys[1]) : entry.count === 1 ? entry.one : entry.many;
      return `${new Intl.NumberFormat(locale === "en" ? "en-US" : "es-ES").format(entry.count)} ${label}`;
    });
    if (parts.length < 2) return parts[0] ?? null;
    return `${parts.slice(0, -1).join(", ")} ${t("listConjunction")} ${parts[parts.length - 1]}`;
  };
  const cascadeSummary = impact ? formatCounts(impact.cascading) : null;
  const optionalSummary = impact ? formatCounts([impact.expenses, impact.notes]) : null;
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
      showToast({ type: "success", message: t("tripDeleted") });
      onClose();
      onDeleted();
    } catch (err) {
      const message =
        err instanceof TripChildDeletionError
          ? err.message
          : queryErrorKind(err) === "timeout"
            ? t("connectionTimeout")
            : getErrorMessage(err, t("deleteTripError"));

      logger.error("DeleteTripDialog: delete failed", { error: message });
      showToast({ type: "error", title: t("deleteTripError"), message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("tripDelete")}>
      <div className="space-y-4">
        <p className="text-sm text-ink">
          {t("deleteTripConfirm").replace("{title}", trip.title)}
        </p>

        {loadingImpact ? (
          <p className="text-sm text-muted" role="status">
            {t("calculatingDeletion")}
          </p>
        ) : cascadeSummary ? (
          <p className="text-sm text-ink">
            {t("deletionSummary").replace("{summary}", cascadeSummary)}
          </p>
        ) : (
          <p className="text-sm text-muted">
            {t("noRelatedData")}
          </p>
        )}

        {hasOptional && optionalSummary && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">
              {t("expensesAndNotes")}
            </legend>
            <p className="text-sm text-muted">
              {t("deletionOptionalPrompt").replace("{summary}", optionalSummary)}
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
                  {t("keepWithoutTrip")}
                </span>
                <span className="block text-xs text-muted">
                  {t("keepWithoutTripHint")}
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
                  {t("deleteAsWell")}
                </span>
                <span className="block text-xs text-muted">
                  {t("deleteAsWellHint")}
                </span>
              </span>
            </label>
          </fieldset>
        )}

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={deleting}
            disabled={loadingImpact}
            onClick={handleConfirm}
          >
            {t("tripDelete")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
