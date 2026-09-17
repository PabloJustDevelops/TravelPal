"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JournalPhoto } from "@/lib/insforge";
import { createInsforgeClient, JOURNAL_PHOTOS_BUCKET } from "@/lib/insforge";
import {
  assertRowsAffected,
  queryErrorKind,
  withQueryTimeout,
  type QueryErrorKind,
} from "@/lib/insforge-query";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";
import { showToast } from "@/lib/toast";
import {
  CONNECTION_TIMEOUT_MESSAGE,
  getErrorMessage,
  getLoadErrorMessage,
} from "@/lib/utils";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { PhotoIcon, TrashIcon } from "@heroicons/react/24/outline";

const MAX_BYTES = 5 * 1024 * 1024;
const LOAD_ERROR = "No se pudieron cargar las fotos del diario";

function objectKey(userId: string, tripId: string, fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
  const random = Math.random().toString(36).slice(2);
  return `${userId}/${tripId}/${random}.${ext}`;
}

export default function JournalPhotos({ tripId }: { tripId: string }) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<JournalPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{
    kind: QueryErrorKind;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const insforge = createInsforgeClient();
      const { data, error: photoError } = await withQueryTimeout(
        insforge.database
          .from("journal_photos")
          .select("*")
          .eq("trip_id", tripId)
          .order("created_at", { ascending: false }),
        { label: "journal-photos" },
      );

      if (photoError) throw photoError;

      setPhotos((data ?? []) as JournalPhoto[]);
    } catch (err) {
      logger.error("JournalPhotos: load failed", err);
      setLoadError({ kind: queryErrorKind(err) });
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadErrorMessage = getLoadErrorMessage(loadError, {
    timeout: "La carga de las fotos ha tardado demasiado.",
    request: LOAD_ERROR,
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user?.id) return;

    const file = files[0];
    if (file.size > MAX_BYTES) {
      showToast({
        type: "error",
        title: "Foto demasiado grande",
        message: "Cada foto puede pesar hasta 5 MB.",
      });
      return;
    }

    setUploading(true);

    try {
      const insforge = createInsforgeClient();
      const key = objectKey(user.id, tripId, file.name);

      const { data, error: uploadError } = await withQueryTimeout(
        insforge.storage.from(JOURNAL_PHOTOS_BUCKET).upload(key, file),
        { label: "storage:upload" },
      );

      if (uploadError) throw uploadError;

      const url = data?.url;
      // La key la devuelve el propio upload; guardamos esa, no la inventada,
      // porque es la que identifica el objeto para borrarlo despues.
      const storedKey = data?.key ?? key;
      if (!url) throw new Error("No se pudo obtener la url de la foto");

      const { error: insertError } = await withQueryTimeout(
        insforge.database
          .from("journal_photos")
          .insert([{ user_id: user.id, trip_id: tripId, url, key: storedKey }]),
        { label: "journal-photos:insert" },
      );

      if (insertError) {
        // Sin fila no hay foto: no dejamos el objeto huerfano en el bucket.
        await withQueryTimeout(
          insforge.storage.from(JOURNAL_PHOTOS_BUCKET).remove(storedKey),
          { label: "storage:remove" },
        );
        throw insertError;
      }

      await load();
    } catch (err) {
      const message =
        queryErrorKind(err) === "timeout"
          ? CONNECTION_TIMEOUT_MESSAGE
          : getErrorMessage(err, "No se pudo subir la foto");
      logger.error("JournalPhotos: upload failed", { error: message });
      showToast({ type: "error", title: "Error al subir la foto", message });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (photo: JournalPhoto) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Quieres borrar esta foto?")
    ) {
      return;
    }

    setBusyId(photo.id);

    try {
      const insforge = createInsforgeClient();

      const { error: storageError } = await withQueryTimeout(
        insforge.storage.from(JOURNAL_PHOTOS_BUCKET).remove(photo.key),
        { label: "storage:remove" },
      );
      if (storageError) throw storageError;

      const { data: deletedRows, error: deleteError } = await withQueryTimeout(
        insforge.database
          .from("journal_photos")
          .delete()
          .eq("id", photo.id)
          .select(),
        { label: "journal-photos:delete" },
      );
      if (deleteError) throw deleteError;
      assertRowsAffected(deletedRows, "No se pudo borrar la foto");

      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      showToast({ type: "success", message: "Foto borrada" });
    } catch (err) {
      const message =
        queryErrorKind(err) === "timeout"
          ? CONNECTION_TIMEOUT_MESSAGE
          : getErrorMessage(err, "No se pudo borrar la foto");
      logger.error("JournalPhotos: delete failed", { error: message });
      showToast({ type: "error", title: "Error al borrar la foto", message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mt-6 border-t border-line pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 font-serif text-heading leading-snug text-ink">
          <PhotoIcon className="h-5 w-5 text-muted" aria-hidden="true" />
          Fotos
        </h3>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Anadir foto al diario"
            onChange={(event) => handleFiles(event.target.files)}
            disabled={uploading}
          />
          <Button
            size="sm"
            loading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            Anadir foto
          </Button>
        </div>
      </div>

      {loading ? (
        <div
          role="status"
          aria-label="Cargando las fotos del diario"
          className="flex justify-center py-8"
        >
          <LoadingSpinner />
        </div>
      ) : loadErrorMessage ? (
        <ErrorState message={loadErrorMessage} onRetry={load} />
      ) : photos.length === 0 ? (
        <EmptyState
          icon={<PhotoIcon className="h-12 w-12" />}
          title="Todavia no hay fotos del viaje"
          description="Anade las fotos que quieras recordar de este viaje."
        />
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="relative overflow-hidden rounded-xs border border-line"
            >
              <img
                src={photo.url}
                alt="Foto del diario"
                className="h-40 w-full object-cover"
              />
              <div className="absolute right-2 top-2">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Borrar foto"
                  className="bg-paper text-danger"
                  loading={busyId === photo.id}
                  onClick={() => handleDelete(photo)}
                >
                  <TrashIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
