"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { formatNumber } from "@/lib/i18n";
import type { JournalEntry } from "@/lib/insforge";
import { createInsforgeClient } from "@/lib/insforge";
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
  cn,
    getErrorMessage,
  getLoadErrorMessage,
} from "@/lib/utils";
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
  readOnly?: boolean;
}



function Rating({ rating, label }: { rating?: number; label: (rating: number) => string }) {
  if (!rating) return null;

  return (
    <span
      className="flex items-center gap-0.5"
      aria-label={label(rating)}
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

export default function TripJournal({ tripId, readOnly = false }: TripJournalProps) {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{
    kind: QueryErrorKind;
  } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const insforge = createInsforgeClient();
      const { data, error: entryError } = await withQueryTimeout(
        insforge.database
          .from("journal_entries")
          .select("*")
          .eq("trip_id", tripId)
          .order("entry_date", { ascending: false }),
        { label: "journal-entries" },
      );

      if (entryError) throw entryError;

      setEntries((data ?? []) as JournalEntry[]);
    } catch (err) {
      logger.error("TripJournal: load failed", err);
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
    request: t("journalLoadError"),
  });

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
        const { data: updatedRows, error: saveError } = await withQueryTimeout(
          insforge.database
            .from("journal_entries")
            .update(payload)
            .eq("id", editingEntry.id)
            .select(),
          { label: "journal-entries:update" },
        );

        if (saveError) throw saveError;
        assertRowsAffected(updatedRows, t("entrySaveError"));
      } else {
        if (!user?.id) throw new Error(t("sessionUnavailable"));

        const { error: saveError } = await withQueryTimeout(
          insforge.database
            .from("journal_entries")
            .insert([{ ...payload, user_id: user.id, trip_id: tripId }]),
          { label: "journal-entries:insert" },
        );

        if (saveError) throw saveError;
      }

      closeEditor();
      await load();
    } catch (err) {
      logger.error("TripJournal: save failed", err);
      // El formulario ensena el mensaje; no lo tragamos.
      throw new Error(
        queryErrorKind(err) === "timeout"
          ? t("connectionTimeout")
          : getErrorMessage(err, t("entrySaveError")),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: JournalEntry) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(t("deleteEntryConfirm"))
    ) {
      return;
    }

    try {
      const insforge = createInsforgeClient();
      const { data: deletedRows, error: deleteError } = await withQueryTimeout(
        insforge.database
          .from("journal_entries")
          .delete()
          .eq("id", entry.id)
          .select(),
        { label: "journal-entries:delete" },
      );

      if (deleteError) throw deleteError;
      assertRowsAffected(deletedRows, t("entryDeleteError"));

      setEntries((current) => current.filter((item) => item.id !== entry.id));
      showToast({ type: "success", message: t("entryDeleted") });
    } catch (err) {
      const message =
        queryErrorKind(err) === "timeout"
          ? t("connectionTimeout")
          : getErrorMessage(err, t("entryDeleteError"));
      logger.error("TripJournal: delete failed", { error: message });
      showToast({ type: "error", title: t("entryDeleteError"), message });
    }
  };

  return (
    <Card className="rounded-none border-0 bg-transparent">
      <CardHeader className="border-b border-line px-0 pt-0 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpenIcon className="h-5 w-5 text-muted" aria-hidden="true" />
            {t("journal")}
          </CardTitle>
          {!readOnly && <Button onClick={openNewEntry} size="sm" className="min-h-11">
            {t("addEntry")}
          </Button>}
        </div>
      </CardHeader>
      <CardContent className="px-0 py-5">
        {loading ? (
          <div
            role="status"
            aria-label={t("journalLoading")}
            className="flex justify-center py-8"
          >
            <LoadingSpinner />
          </div>
        ) : loadErrorMessage ? (
          <ErrorState message={loadErrorMessage} title={t("journalErrorTitle")} retryLabel={t("retry")} onRetry={load} />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<BookOpenIcon className="h-12 w-12" />}
            title={t("journalEmptyTitle")}
            description={t("journalEmptyDescription")}
            action={!readOnly ? <Button onClick={openNewEntry}>{t("firstJournalEntry")}</Button> : undefined}
          />
        ) : (
          <ol className="space-y-6">
            {entries.map((entry) => (
              <li key={entry.id} className="border-b border-line pb-5 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-lg font-semibold leading-snug text-ink">
                        {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", { day: "numeric", month: "long", year: "numeric" }).format(new Date(entry.entry_date))}
                      </p>
                      <Rating rating={entry.rating} label={(rating) => t("rating").replace("{rating}", formatNumber(rating, locale))} />
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-reading text-ink">
                      {entry.content}
                    </p>
                  </div>
                  {!readOnly && <div className="flex flex-shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditEntry(entry)}
                      aria-label={t("editEntry")}
                      className="min-h-11 min-w-11"
                    >
                      <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(entry)}
                      aria-label={t("deleteEntry")}
                      className="min-h-11 min-w-11 text-danger"
                    >
                      <TrashIcon className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>}
                </div>
              </li>
            ))}
          </ol>
        )}

        <JournalPhotos tripId={tripId} readOnly={readOnly} />
      </CardContent>

      {!readOnly && <Modal
        isOpen={editorOpen}
        onClose={closeEditor}
        title={editingEntry ? t("editEntry") : t("newEntry")}
        size="lg"
      >
        <JournalEntryForm
          entry={editingEntry}
          onSave={handleSave}
          onCancel={closeEditor}
          loading={saving}
        />
      </Modal>
      }
    </Card>
  );
}
