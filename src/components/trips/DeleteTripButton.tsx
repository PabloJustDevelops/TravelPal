"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import DeleteTripDialog from "./DeleteTripDialog";
import { cn } from "@/lib/utils";
import { TrashIcon } from "@heroicons/react/24/outline";
import { useI18n } from "@/lib/i18n/LocaleProvider";

interface DeleteTripButtonProps {
  trip: { id: string; title: string };
  onDeleted: () => void;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Disparador del borrado de un viaje: abre el dialogo, que cuenta lo que se
 * lleva el viaje y ofrece elegir que pasa con gastos y notas.
 */
export default function DeleteTripButton({
  trip,
  onDeleted,
  size = "sm",
  className,
}: DeleteTripButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useI18n();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={() => setIsOpen(true)}
        aria-label={t("deleteTripAria").replace("{title}", trip.title)}
        className={cn("min-h-11 border-danger text-danger hover:bg-danger/10", className)}
      >
        <TrashIcon className="h-4 w-4 mr-1" aria-hidden="true" />
        {t("tripDelete")}
      </Button>
      <DeleteTripDialog
        trip={trip}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onDeleted={onDeleted}
      />
    </>
  );
}
