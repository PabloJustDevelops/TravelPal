"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";

import NoteEditor from "@/components/notes/NoteEditor";
import Button from "@/components/ui/Button";
import PageTitle from "@/components/ui/PageTitle";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";

import { selectClassName } from "@/components/ui/fieldStyles";
import ErrorState from "@/components/ui/ErrorState";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient, Note, Trip } from "@/lib/insforge";
import {
  assertRowsAffected,
  queryErrorKind,
  withQueryTimeout,
  type QueryErrorKind,
} from "@/lib/insforge-query";
import { logger } from "@/lib/logger";
import {
  CONNECTION_TIMEOUT_MESSAGE,
  getErrorMessage,
  getLoadErrorMessage,
} from "@/lib/utils";
import { showToast } from "@/lib/toast";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  StarIcon,
} from "@heroicons/react/24/outline";

export default function NotesPage() {
  const { user, loading: authLoading } = useAuth();
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [dirty, setDirty] = useState(false);
  const onDirtyChange = useCallback((value: boolean) => setDirty(value), []);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [tripFilter, setTripFilter] = useState<string>("all");

  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);

  const [data, setData] = useState<{
    notes: (Note & { trip?: Trip })[];
    trips: Trip[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{
    kind: QueryErrorKind;
  } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      setData(null);
      setLoading(false);
      return;
    }

    const userId = user.id;
    let active = true;

    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const insforge = createInsforgeClient();
        const [notesRes, tripsRes] = await withQueryTimeout(
          Promise.all([
            insforge.database
              .from("notes")
              .select(`*, trip:trips(*)`)
              .eq("user_id", userId)
              .order("updated_at", { ascending: false }),
            insforge.database
              .from("trips")
              .select(
                "id, title, user_id, origin, destination, departure_date, return_date, status, created_at, updated_at",
              )
              .eq("user_id", userId)
              .order("departure_date", { ascending: false }),
          ]),
          { label: "notes" },
        );

        if (notesRes.error) throw notesRes.error;
        if (tripsRes.error) throw tripsRes.error;

        if (!active) return;
        setEditingNote(
          (current) => current || ((notesRes.data as Note[]) ?? [])[0] || null,
        );
        setData({
          notes: (notesRes.data as (Note & { trip?: Trip })[]) ?? [],
          trips: (tripsRes.data as Trip[]) ?? [],
        });
      } catch (err) {
        if (!active) return;
        logger.error("NotesPage: Error loading notes", {
          error: getErrorMessage(err, "Error al cargar las notas"),
        });
        setLoadError({ kind: queryErrorKind(err) });
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authLoading, user?.id, reloadToken]);

  const { notes, trips, filteredNotes } = useMemo(() => {
    const notesData = data?.notes ?? [];
    const tripsData = data?.trips ?? [];

    let filtered = favoritesOnly
      ? notesData.filter((note) => note.is_favorite)
      : notesData;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (note) =>
          note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
          note.trip?.title.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Filter by category
    if (categoryFilter !== "all") {
      filtered = filtered.filter((note) => note.category === categoryFilter);
    }

    // Filter by trip
    if (tripFilter !== "all") {
      filtered = filtered.filter((note) => note.trip_id === tripFilter);
    }

    return { notes: notesData, trips: tripsData, filteredNotes: filtered };
  }, [data, searchTerm, categoryFilter, tripFilter, favoritesOnly]);

  const error = getLoadErrorMessage(loadError, {
    timeout: "La carga de notas ha tardado demasiado.",
    request: "Error al cargar las notas. Por favor, inténtalo de nuevo.",
  });

  const showSkeleton =
    authLoading || loading || (!!user?.id && data === null && !loadError);

  const handleSaveNote = async (noteData: Partial<Note>) => {
    if (!user) return;

    setEditorLoading(true);

    try {
      if (editingNote) {
        // Update existing note
        // TODO: Implement PUT API
        const insforge = createInsforgeClient();
        const { data: updatedRows, error } = await withQueryTimeout(
          insforge.database
            .from("notes")
            .update({
              title: noteData.title,
              content: noteData.content,
              category: noteData.category,
              trip_id: noteData.trip_id || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", editingNote.id)
            .select(),
          { label: "notes:update" },
        );

        if (error) throw error;
        assertRowsAffected(updatedRows, "No se pudo actualizar la nota");
      } else {
        // Create new note using the InsForge SDK
        const insforge = createInsforgeClient();
        const { error } = await withQueryTimeout(
          insforge.database
            .from("notes")
            .insert([
              {
                user_id: user.id,
                title: noteData.title,
                content: noteData.content,
                category: noteData.category || "general",
                trip_id: noteData.trip_id || null,
                is_favorite: false,
              },
            ])
            .select()
            .single(),
          { label: "notes:insert" },
        );

        if (error) throw error;
      }

      setDirty(false);
      setShowEditor(false);
      setEditingNote(null);
      refetch();
    } catch (err: unknown) {
      const message =
        queryErrorKind(err) === "timeout"
          ? CONNECTION_TIMEOUT_MESSAGE
          : getErrorMessage(err, "Error al guardar la nota");
      logger.error("NotesPage: Error saving note", { error: message });
      showToast({
        type: "error",
        title: "Error al guardar la nota",
        message,
      });
      throw new Error(message);
    } finally {
      setEditorLoading(false);
    }
  };

  const confirmDiscard = () =>
    !dirty ||
    window.confirm("Tienes cambios sin guardar. ¿Quieres descartarlos?");
  const handleEditNote = (note: Note | null) => {
    if (editorLoading) return;
    if (
      (editingNote || showEditor) &&
      (note?.id || null) === (editingNote?.id || null)
    ) {
      setShowEditor(true);
      return;
    }
    if (!confirmDiscard()) return;
    setDirty(false);
    setEditingNote(note);
    setShowEditor(true);
  };
  const handleCloseEditor = () => {
    if (editorLoading || !confirmDiscard()) return;
    setDirty(false);
    setShowEditor(false);
    setEditingNote(null);
  };
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest?.("a[href]");
      if (
        link &&
        !window.confirm(
          "Tienes cambios sin guardar. ¿Quieres salir y descartarlos?",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", guard, true);
    return () => document.removeEventListener("click", guard, true);
  }, [dirty]);
  const toggleFavorite = async (note: Note) => {
    try {
      const result = await withQueryTimeout(
        createInsforgeClient()
          .database.from("notes")
          .update({ is_favorite: !note.is_favorite })
          .eq("id", note.id)
          .eq("user_id", user!.id)
          .select(),
        { label: "notes:favorite" },
      );
      if (result.error) throw result.error;
      assertRowsAffected(result.data, "No se pudo actualizar la favorita");
      setData((previous) =>
        previous
          ? {
              ...previous,
              notes: previous.notes.map((item) =>
                item.id === note.id
                  ? { ...item, is_favorite: !note.is_favorite }
                  : item,
              ),
            }
          : previous,
      );
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo actualizar la favorita",
        message: getErrorMessage(error, "Inténtalo de nuevo"),
      });
    }
  };

  if (showSkeleton) {
    return <DashboardLayout skeleton="notes" pending />;
  }

  if (error) {
    return (
      <DashboardLayout skeleton="notes">
        <ErrorState message={error} onRetry={() => refetch()} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout skeleton="notes">
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold text-ink">
            Inicia sesión para gestionar tus notas
          </h3>
          <p className="mt-1 text-sm text-muted">
            La sección de notas requiere autenticación.
          </p>
          <Button
            className="mt-4"
            onClick={() => (window.location.href = "/signin")}
          >
            Ir a Login
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout skeleton="notes">
      <div className="space-y-6">
        {/* Header */}
        <PageTitle
          title="Tu cuaderno de viaje"
          subtitle="Direcciones, ideas y detalles que merece la pena guardar."
          action={
            <Button onClick={() => handleEditNote(null)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Nueva Nota
            </Button>
          }
        />

        {/* Filters */}
        <div className="border-b border-line pb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
                <Input
                  type="text"
                  placeholder="Buscar notas..."
                  aria-label="Buscar notas"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="lg:w-48">
              <select
                aria-label="Filtrar por categoría"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={selectClassName}
              >
                <option value="all">Todas las categorías</option>
                <option value="general">General</option>
                <option value="itinerary">Itinerario</option>
                <option value="accommodation">Alojamiento</option>
                <option value="transport">Transporte</option>
                <option value="restaurant">Restaurante</option>
                <option value="activity">Actividad</option>
                <option value="shopping">Compras</option>
                <option value="emergency">Emergencia</option>
                <option value="contact">Contacto</option>
              </select>
            </div>

            {/* Trip Filter */}
            <div className="lg:w-48">
              <select
                aria-label="Filtrar por viaje"
                value={tripFilter}
                onChange={(e) => setTripFilter(e.target.value)}
                className={selectClassName}
              >
                <option value="all">Todos los viajes</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 rounded-lg border border-line lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
          <section
            aria-label="Lista de notas"
            className={`${showEditor ? "hidden lg:block" : ""} min-w-0 p-4 lg:border-r lg:border-line`}
          >
            <div className="mb-3 flex flex-wrap gap-1 border-b border-line pb-3">
              <Button
                variant="ghost"
                aria-pressed={!favoritesOnly}
                onClick={() => setFavoritesOnly(false)}
                className={`min-h-11 ${!favoritesOnly ? "text-accent" : ""}`}
              >
                Todas las notas
              </Button>
              <Button
                variant="ghost"
                aria-pressed={favoritesOnly}
                onClick={() => setFavoritesOnly(true)}
                className={`min-h-11 ${favoritesOnly ? "text-accent" : ""}`}
              >
                Favoritas
              </Button>
            </div>
            {filteredNotes.length ? (
              <ul className="divide-y divide-line">
                {filteredNotes.map((note) => (
                  <li
                    key={note.id}
                    className={`flex items-start gap-1 rounded-md py-3 ${editingNote?.id === note.id ? "bg-accent-soft" : ""}`}
                  >
                    <Button
                      variant="ghost"
                      aria-label={`Editar nota ${note.title}`}
                      className="h-auto min-h-11 min-w-0 flex-1 flex-col items-start px-3 py-3 text-left"
                      onClick={() => handleEditNote(note)}
                    >
                      <span className="break-words text-base font-bold text-ink">
                        {note.title}
                      </span>
                      <span className="mt-1 line-clamp-2 break-words text-sm font-normal text-muted">
                        {note.content}
                      </span>
                      <span className="mt-3 text-xs font-normal text-muted">
                        {({general:'General',itinerary:'Itinerario',accommodation:'Alojamiento',transport:'Transporte',restaurant:'Restaurante',activity:'Actividad',shopping:'Compras',emergency:'Emergencia',contact:'Contacto'} as Record<string,string>)[note.category || 'general'] || note.category} ·{" "}
                        {new Date(note.updated_at).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                        })}
                        {note.trip?.title ? ` · ${note.trip.title}` : ""}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`${note.is_favorite ? "Quitar de" : "Añadir a"} favoritas: ${note.title}`}
                      aria-pressed={note.is_favorite}
                      onClick={() => void toggleFavorite(note)}
                      className="min-h-11 min-w-11 px-2"
                    >
                      <StarIcon
                        className={`h-5 w-5 ${note.is_favorite ? "fill-accent text-accent" : "text-muted"}`}
                        aria-hidden="true"
                      />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<DocumentTextIcon className="h-8 w-8" />}
                title={
                  notes.length
                    ? "No se encontraron notas"
                    : "No tienes notas registradas"
                }
                description="Guarda aquí tus ideas y los detalles del viaje."
                action={
                  !notes.length ? (
                    <Button onClick={() => handleEditNote(null)}>
                      Crear Primera Nota
                    </Button>
                  ) : undefined
                }
              />
            )}
          </section>
          <div
            className={`${showEditor ? "block" : "hidden lg:block"} min-w-0`}
          >
            {showEditor || editingNote ? (
              <NoteEditor
                key={editingNote?.id || "new"}
                note={editingNote || undefined}
                trips={trips}
                onSave={handleSaveNote}
                onCancel={handleCloseEditor}
                loading={editorLoading}
                onDirtyChange={onDirtyChange}
              />
            ) : (
              <div className="p-8 text-muted">
                <h2 className="text-xl font-semibold text-ink">
                  Un lugar para lo que quieres recordar
                </h2>
                <p className="mt-3">
                  Selecciona una nota o crea una nueva para empezar a escribir.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
