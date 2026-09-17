"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import NoteCard from "@/components/notes/NoteCard";
import NoteEditor from "@/components/notes/NoteEditor";
import Button from "@/components/ui/Button";
import PageTitle from "@/components/ui/PageTitle";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { selectClassName } from "@/components/ui/fieldStyles";
import ErrorState from "@/components/ui/ErrorState";
import { useAuth } from "@/contexts/AuthContext";
import { createInsforgeClient, Note, Trip } from "@/lib/insforge";
import { assertRowsAffected } from "@/lib/insforge-query";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/utils";
import { showToast } from "@/lib/toast";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import PageSkeleton from "@/components/ui/PageSkeleton";

export default function NotesPage() {
  const { user, loading: authLoading } = useAuth();
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
  const [loadError, setLoadError] = useState(false);
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
    setLoadError(false);

    (async () => {
      try {
        const insforge = createInsforgeClient();
        const [notesRes, tripsRes] = await Promise.all([
          insforge
            .database.from("notes")
            .select(`*, trip:trips(*)`)
            .eq("user_id", userId)
            .order("updated_at", { ascending: false }),
          insforge
            .database.from("trips")
            .select(
              "id, title, user_id, origin, destination, departure_date, return_date, status, created_at, updated_at",
            )
            .eq("user_id", userId)
            .order("departure_date", { ascending: false }),
        ]);

        if (notesRes.error) throw notesRes.error;
        if (tripsRes.error) throw tripsRes.error;

        if (!active) return;
        setData({
          notes: (notesRes.data as (Note & { trip?: Trip })[]) ?? [],
          trips: (tripsRes.data as Trip[]) ?? [],
        });
      } catch (err) {
        if (!active) return;
        logger.error("NotesPage: Error loading notes", {
          error: getErrorMessage(err, "Error al cargar las notas"),
        });
        setLoadError(true);
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

    let filtered = notesData;

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
  }, [data, searchTerm, categoryFilter, tripFilter]);

  const error = loadError
    ? "Error al cargar las notas. Por favor, inténtalo de nuevo."
    : null;

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
        const { data: updatedRows, error } = await insforge
          .database.from("notes")
          .update({
            title: noteData.title,
            content: noteData.content,
            category: noteData.category,
            trip_id: noteData.trip_id || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingNote.id)
          .select();

        if (error) throw error;
        assertRowsAffected(updatedRows, "No se pudo actualizar la nota");
      } else {
        // Create new note using the InsForge SDK
        const insforge = createInsforgeClient();
        const { error } = await insforge
          .database.from("notes")
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
          .single();

        if (error) throw error;
      }

      refetch();
      handleCloseEditor();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Error al guardar la nota");
      logger.error("NotesPage: Error saving note", { error: message });
      showToast({
        type: "error",
        title: "Error al guardar la nota",
        message,
      });
    } finally {
      setEditorLoading(false);
    }
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setShowEditor(true);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setEditingNote(null);
  };

  // Funciones auxiliares eliminadas - no se utilizan en este componente

  const getCategoryCounts = () => {
    return notes.reduce(
      (acc, note) => {
        const category = note.category || "general";
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  };

  const categoryCounts = getCategoryCounts();

  if (showSkeleton) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <ErrorState message={error} onRetry={() => refetch()} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
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
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageTitle
          title="Mis Notas"
          subtitle="Organiza y documenta toda la información de tus viajes"
          action={
            <Button onClick={() => setShowEditor(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Nueva Nota
            </Button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface p-4 rounded-lg shadow-sm border border-line">
            <div className="flex items-center">
              <DocumentTextIcon className="h-8 w-8 text-accent" />
              <div className="ml-3">
                <div className="text-sm font-medium text-muted">
                  Total Notas
                </div>
                <div className="text-2xl font-bold text-ink">
                  {notes.length}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface p-4 rounded-lg shadow-sm border border-line">
            <div className="flex items-center">
              <CalendarDaysIcon className="h-8 w-8 text-accent" />
              <div className="ml-3">
                <div className="text-sm font-medium text-muted">
                  Itinerarios
                </div>
                <div className="text-2xl font-bold text-ink">
                  {categoryCounts.itinerary || 0}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface p-4 rounded-lg shadow-sm border border-line">
            <div className="flex items-center">
              <BuildingOffice2Icon className="h-8 w-8 text-accent" />
              <div className="ml-3">
                <div className="text-sm font-medium text-muted">
                  Alojamientos
                </div>
                <div className="text-2xl font-bold text-ink">
                  {categoryCounts.accommodation || 0}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface p-4 rounded-lg shadow-sm border border-line">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-8 w-8 text-accent" />
              <div className="ml-3">
                <div className="text-sm font-medium text-muted">
                  Emergencias
                </div>
                <div className="text-2xl font-bold text-ink">
                  {categoryCounts.emergency || 0}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-surface p-4 rounded-lg shadow-sm border border-line">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
                <Input
                  type="text"
                  placeholder="Buscar notas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="lg:w-48">
              <select
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

        {/* Notes Grid */}
        {filteredNotes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                showTripTitle
                onEdit={handleEditNote}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<DocumentTextIcon className="h-12 w-12" />}
            title={
              searchTerm || categoryFilter !== "all" || tripFilter !== "all"
                ? "No se encontraron notas"
                : "No tienes notas registradas"
            }
            description={
              searchTerm || categoryFilter !== "all" || tripFilter !== "all"
                ? "Intenta ajustar los filtros de búsqueda"
                : "Comienza creando tu primera nota"
            }
            action={
              !searchTerm &&
              categoryFilter === "all" &&
              tripFilter === "all" ? (
                <Button onClick={() => setShowEditor(true)}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Crear Primera Nota
                </Button>
              ) : undefined
            }
          />
        )}

        {/* Note Editor Modal */}
        <Modal
          isOpen={showEditor}
          onClose={handleCloseEditor}
          title={editingNote ? "Editar Nota" : "Nueva Nota"}
          size="xl"
        >
          <NoteEditor
            note={editingNote || undefined}
            trips={trips}
            onSave={handleSaveNote}
            onCancel={handleCloseEditor}
            loading={editorLoading}
          />
        </Modal>
      </div>
    </DashboardLayout>
  );
}
