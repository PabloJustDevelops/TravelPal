"use client";

import { useCallback, useEffect, useState } from "react";
import type { JournalEntry } from "@/lib/insforge";
import { createInsforgeClient } from "@/lib/insforge";
import { assertRowsAffected } from "@/lib/insforge-query";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";
import { showToast } from "@/lib/toast";
import { cn, formatDate, getErrorMessage } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import JournalEntryForm, {
  type JournalEntryValues,
} from "@/components/trips/JournalEntryForm";
import JournalPhotos from "@/components/trips/JournalPhotos";
import {
  BookOpenIcon,
  PencilSquareIcon,
  StarIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

interface TripJournalProps {
  tripId: string;
}

const LOAD_ERROR = "No se pudo cargar el diario del viaje";

function Rating({ rating }: { rating?: number }) {
  if (!rating) return null;

  return (
    <span
      className="flex items-center gap-0.5"
      aria-label={`Valoracion: ${rating} de 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          className={cn("h-4 w-4", star <= rating ? "text-accent" : "text-line")}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export default function TripJournal({ tripId }: TripJournalProps) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const insforge = createInsforgeClient();
      const { data, error: loadError } = await insforge.database
        .from("journal_entries")
        .select("*")
        .eq("trip_id", tripId)
        .order("entry_date", { ascending: false });

      if (loadError) throw loadError;

      setEntries((data ?? []) as JournalEntry[]);
    } catch (err) {
      logger.error("TripJournal: load failed", err);
      setError(LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const openNewEntry = () => {
    setEditingEntry(null);
    setEditorOpen(true);
  };

  const openEditEntry = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingEntry(null);
  };

  const handleSave = async (values: JournalEntryValues) => {
    setSaving(true);

    try {
      const insforge = createInsforgeClient();
      const payload = {
        entry_date: values.entry_date,
        content: values.content,
        rating: values.rating ?? null,
      };

      if (editingEntry) {
        const { data: updatedRows, error: saveError } = await insforge.database
          .from("journal_entries")
          .update(payload)
          .eq("id", editingEntry.id)
          .select();

        if (saveError) throw saveError;
        assertRowsAffected(updatedRows, "No se pudo guardar la entrada");
      } else {
        if (!user?.id) throw new Error("Sesion no disponible");

        const { error: saveError } = await insforge.database
          .from("journal_entries")
          .insert([{ ...payload, user_id: user.id, trip_id: tripId }]);

        if (saveError) throw saveError;
      }

      closeEditor();
      await load();
    } catch (err) {
      logger.error("TripJournal: save failed", err);
      // El formulario ensena el mensaje; no lo tragamos.
      throw new Error(getErrorMessage(err, "No se pudo guardar la entrada"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: JournalEntry) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Quieres borrar esta entrada del diario?")
    ) {
      return;
    }

    try {
      const insforge = createInsforgeClient();
      const { data: deletedRows, error: deleteError } = await insforge.database
        .from("journal_entries")
        .delete()
        .eq("id", entry.id)
        .select();

      if (deleteError) throw deleteError;
      assertRowsAffected(deletedRows, "No se pudo borrar la entrada");

      setEntries((current) => current.filter((item) => item.id !== entry.id));
      showToast({ type: "success", message: "Entrada borrada" });
    } catch (err) {
      const message = getErrorMessage(err, "No se pudo borrar la entrada");
      logger.error("TripJournal: delete failed", { error: message });
      showToast({ type: "error", title: "Error al borrar la entrada", message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpenIcon className="h-5 w-5 text-muted" aria-hidden="true" />
            Diario
          </CardTitle>
          <Button onClick={openNewEntry} size="sm">
            Anadir entrada
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div
            role="status"
            aria-label="Cargando el diario del viaje"
            className="flex justify-center py-8"
          >
            <LoadingSpinner />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<BookOpenIcon className="h-12 w-12" />}
            title="Todavia no has escrito el diario de este viaje"
            description="Guarda como fue cada dia para que el viaje no se quede en fotos."
            action={<Button onClick={openNewEntry}>Escribir la primera entrada</Button>}
          />
        ) : (
          <ol className="space-y-6">
            {entries.map((entry) => (
              <li key={entry.id} className="border-b border-line pb-5 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-serif text-heading leading-snug text-ink">
                        {formatDate(entry.entry_date)}
                      </p>
                      <Rating rating={entry.rating} />
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-reading text-ink">
                      {entry.content}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditEntry(entry)}
                      aria-label="Editar entrada"
                    >
                      <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(entry)}
                      aria-label="Borrar entrada"
                      className="text-danger"
                    >
                      <TrashIcon className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        <JournalPhotos tripId={tripId} />
      </CardContent>

      <Modal
        isOpen={editorOpen}
        onClose={closeEditor}
        title={editingEntry ? "Editar entrada" : "Nueva entrada"}
        size="lg"
      >
        <JournalEntryForm
          entry={editingEntry}
          onSave={handleSave}
          onCancel={closeEditor}
          loading={saving}
        />
      </Modal>
    </Card>
  );
}
