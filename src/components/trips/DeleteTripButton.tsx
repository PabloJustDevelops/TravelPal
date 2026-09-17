"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { deleteTrip, tripDeletionConfirmationMessage } from "@/lib/trips";
import { queryErrorKind } from "@/lib/insforge-query";
import { logger } from "@/lib/logger";
import { showToast } from "@/lib/toast";
import { CONNECTION_TIMEOUT_MESSAGE, cn, getErrorMessage } from "@/lib/utils";
import { TrashIcon } from "@heroicons/react/24/outline";

interface DeleteTripButtonProps {
  trip: { id: string; title: string };
  onDeleted: () => void;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Accion de borrado de un viaje: confirma con el aviso completo, borra por el
 * SDK y avisa al contenedor para que actualice su vista. El dialogo es el
 * `confirm()` que ya usan los demas borrados de la app.
 */
export default function DeleteTripButton({
  trip,
  onDeleted,
  size = "sm",
  className,
}: DeleteTripButtonProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(tripDeletionConfirmationMessage(trip.title))) return;

    setDeleting(true);

    try {
      await deleteTrip(trip.id);
      showToast({ type: "success", message: "Viaje eliminado" });
      onDeleted();
    } catch (err) {
      const message =
        queryErrorKind(err) === "timeout"
          ? CONNECTION_TIMEOUT_MESSAGE
          : getErrorMessage(err, "No se pudo eliminar el viaje");

      logger.error("DeleteTripButton: delete failed", { error: message });
      showToast({ type: "error", title: "Error al eliminar el viaje", message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      loading={deleting}
      onClick={handleDelete}
      aria-label={`Eliminar el viaje ${trip.title}`}
      className={cn("border-danger text-danger hover:bg-danger/10", className)}
    >
      <TrashIcon className="h-4 w-4 mr-1" aria-hidden="true" />
      Eliminar
    </Button>
  );
}
