"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JournalPhoto, JournalPhotoRow } from "@/lib/insforge";
import {
  createInsforgeClient,
  JOURNAL_PHOTOS_BUCKET,
  JOURNAL_PHOTOS_SIGNED_URL_TTL,
} from "@/lib/insforge";
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
  getErrorMessage,
  getLoadErrorMessage,
} from "@/lib/utils";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { PhotoIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const MAX_BYTES = 5 * 1024 * 1024;


function objectKey(userId: string, tripId: string, fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
  const random = Math.random().toString(36).slice(2);
  return `${userId}/${tripId}/${random}.${ext}`;
}

export default function JournalPhotos({ tripId, readOnly = false }: { tripId: string; readOnly?: boolean }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [photos, setPhotos] = useState<JournalPhotoRow[]>([]);
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

      const rows = (data ?? []) as JournalPhoto[];

      // El bucket es privado: la `url` de la fila no autoriza la lectura, hay
      // que pedir una firmada por cada `key`. La firma va en lote y cada entrada
      // falla por su cuenta, asi que una foto sin firma no tumba a las demas.
      const signedUrls = new Map<string, string>();
      if (rows.length > 0) {
        const { data: signed, error: signError } = await withQueryTimeout(
          insforge.storage
            .from(JOURNAL_PHOTOS_BUCKET)
            .createSignedUrls(
              rows.map((row) => row.key),
              JOURNAL_PHOTOS_SIGNED_URL_TTL,
            ),
          { label: "storage:create-signed-urls" },
        );

        if (signError) throw signError;

        for (const entry of signed ?? []) {
          if (entry.signedUrl) signedUrls.set(entry.path, entry.signedUrl);
        }
      }

      setPhotos(
        rows.map((row) => ({
          ...row,
          signedUrl: signedUrls.get(row.key) ?? null,
        })),
      );
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
    timeout: t("journalLoadTimeout"),
    request: t("photosLoadError"),
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user?.id) return;

    const file = files[0];
    if (file.size > MAX_BYTES) {
      showToast({
        type: "error",
        title: t("photoTooLarge"),
        message: t("photoSizeLimit"),
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
      if (!url) throw new Error(t("photoUrlError"));

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
          ? t("connectionTimeout")
          : getErrorMessage(err, t("photoUploadError"));
      logger.error("JournalPhotos: upload failed", { error: message });
      showToast({ type: "error", title: t("photoUploadError"), message });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (photo: JournalPhotoRow) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(t("deletePhotoConfirm"))
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
      assertRowsAffected(deletedRows, t("photoDeleteFailed"));

      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      showToast({ type: "success", message: t("photoDeleted") });
    } catch (err) {
      const message =
        queryErrorKind(err) === "timeout"
          ? t("connectionTimeout")
          : getErrorMessage(err, t("photoDeleteFailed"));
      logger.error("JournalPhotos: delete failed", { error: message });
      showToast({ type: "error", title: t("photoDeleteError"), message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mt-6 border-t border-line pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold leading-snug text-ink">
          <PhotoIcon className="h-5 w-5 text-muted" aria-hidden="true" />
          {t("photos")}
        </h3>
        {!readOnly && <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label={t("addPhotoInputAria")}
            onChange={(event) => handleFiles(event.target.files)}
            disabled={uploading}
          />
          <Button
            size="sm"
            loading={uploading}
            onClick={() => inputRef.current?.click()}
            className="min-h-11"
          >
            {t("addPhoto")}
          </Button>
        </div>}
      </div>

      {loading ? (
        <div
          role="status"
          aria-label={t("photosLoading")}
          className="flex justify-center py-8"
        >
          <LoadingSpinner />
        </div>
      ) : loadErrorMessage ? (
        <ErrorState message={loadErrorMessage} title={t("photosErrorTitle")} retryLabel={t("retry")} onRetry={load} />
      ) : photos.length === 0 ? (
        <EmptyState
          icon={<PhotoIcon className="h-12 w-12" />}
          title={t("photosEmpty")}
          description={t("photosEmptyHint")}
        />
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="relative overflow-hidden rounded-xs border border-line"
            >
              {photo.signedUrl ? (
                <img
                  src={photo.signedUrl}
                  alt={t("journalPhotoAlt")}
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div
                  role="img"
                  aria-label={t("photoUnavailable")}
                  className="flex h-40 w-full items-center justify-center px-3 text-center text-sm text-muted"
                >
                  {t("photoLoadError")}
                </div>
              )}
              {!readOnly && <div className="absolute right-2 top-2">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("deletePhoto")}
                  className="min-h-11 min-w-11 bg-paper text-danger"
                  loading={busyId === photo.id}
                  onClick={() => handleDelete(photo)}
                >
                  <TrashIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
