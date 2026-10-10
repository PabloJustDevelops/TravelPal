"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarIcon,
  MapIcon,
  ClockIcon,
  PlusIcon,
  FunnelIcon,
  PaperAirplaneIcon,
  HomeModernIcon,
  TruckIcon,
  TicketIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import DashboardLayout from "../../components/layout/DashboardLayout";
import {
  Calendar,
  type CalendarEvent,
} from "../../components/calendar/Calendar";
import {
  ItineraryPlanner,
  toPlannerCategory,
  type DayItinerary,
  type PlannerActivity,
  type PlannerActivityDraft,
} from "../../components/planning/ItineraryPlanner";
import { BookingCard } from "../../components/planning/BookingCard";
import Button from "../../components/ui/Button";
import PageTitle from "../../components/ui/PageTitle";
import Input from "../../components/ui/Input";
import { fieldClassName } from "../../components/ui/fieldStyles";
import ErrorState from "../../components/ui/ErrorState";
import { Card } from "../../components/ui/Card";
import Modal from "../../components/ui/Modal";

import NewBookingForm from "../../components/planning/NewBookingForm";
import { useAuth } from "../../contexts/AuthContext";
import { createInsforgeClient, Booking } from "../../lib/insforge";
import {
  assertRowsAffected,
  queryErrorKind,
  withQueryTimeout,
  type QueryErrorKind,
} from "../../lib/insforge-query";
import {
  CONNECTION_TIMEOUT_MESSAGE,
  formatDate,
  cn,
  getErrorMessage,
  getLoadErrorMessage,
} from "../../lib/utils";
import { logger } from "@/lib/logger";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { accentLinkClassName } from "@/components/ui/actionStyles";

import { format } from 'date-fns';

interface Trip {
  id: string;
  title: string;
  destination: string;
  departure_date: string;
  return_date?: string;
  status: string;
}

interface ItineraryActivity {
  id: string;
  trip_id: string;
  title: string;
  date: string;
  start_time?: string;
  end_time?: string;
  category?: string;
  description?: string;
  location?: string;
  cost?: number;
  currency?: string;
  notes?: string;
  completed?: boolean;
}

export default function PlanningPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activities, setActivities] = useState<ItineraryActivity[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<
    "calendar" | "itinerary" | "bookings"
  >("calendar");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [silentReload, setSilentReload] = useState(false);

  const insforge = createInsforgeClient();

  // Función para obtener el icono según el tipo
  const getEventIcon = (type: string, category?: string) => {
    // Si es un booking, el tipo suele ser 'flight', 'hotel', etc.
    // Si es activity, tiene una category
    const typeToCheck = category || type;

    switch (typeToCheck) {
      case "flight":
      case "transport":
        return <PaperAirplaneIcon className="h-3 w-3" />;
      case "hotel":
      case "accommodation":
        return <HomeModernIcon className="h-3 w-3" />;
      case "car":
        return <TruckIcon className="h-3 w-3" />;
      case "activity":
      case "restaurant":
        return <TicketIcon className="h-3 w-3" />;
      default:
        return <TagIcon className="h-3 w-3" />;
    }
  };

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{
    kind: QueryErrorKind;
  } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  // El GET de /api/planning traia tres consultas en paralelo; se reproducen tal
  // cual, tabla a tabla, desde el SDK: mismo `*`, mismo filtro por usuario y el
  // mismo `order` (viajes por salida y reservas por inicio, actividades sin
  // orden), y el cliente decide lo mismo que decidia antes con `data`.
  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      setTrips([]);
      setBookings([]);
      setActivities([]);
      setLoading(false);
      return;
    }

    const userId = user.id;
    let active = true;

    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const client = createInsforgeClient();
        const [tripsRes, bookingsRes, activitiesRes] = await withQueryTimeout(
          Promise.all([
            client
              .database.from("trips")
              .select("*")
              .eq("user_id", userId)
              .order("departure_date", { ascending: true }),
            client
              .database.from("bookings")
              .select("*")
              .eq("user_id", userId)
              .order("start_date", { ascending: true }),
            client
              .database.from("itinerary_activities")
              .select("*")
              .eq("user_id", userId),
          ]),
          { label: "planning" },
        );

        if (tripsRes.error) throw tripsRes.error;
        if (bookingsRes.error) throw bookingsRes.error;
        if (activitiesRes.error) throw activitiesRes.error;

        if (!active) return;
        setTrips((tripsRes.data as Trip[]) ?? []);
        setBookings((bookingsRes.data as Booking[]) ?? []);
        setActivities((activitiesRes.data as ItineraryActivity[]) ?? []);
      } catch (err) {
        if (!active) return;
        logger.error("PlanningPage: Error loading planning data", {
          error: getErrorMessage(err, "Error al cargar la planificación"),
        });
        setLoadError({ kind: queryErrorKind(err) });
      } finally {
        if (active) {
          setLoading(false);
          setSilentReload(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [authLoading, user?.id, reloadToken]);

  const error = getLoadErrorMessage(loadError, {
    timeout: "La carga de datos ha tardado demasiado. Por favor, inténtalo de nuevo.",
    request: "Error al cargar la planificación. Por favor, inténtalo de nuevo.",
  });

  const showSkeleton = authLoading || (loading && !silentReload);

  const generateCalendarEvents = useCallback(() => {
    const calendarEvents: CalendarEvent[] = [];

    // Eventos de viajes
    trips.forEach((trip) => {
      calendarEvents.push({
        id: `trip_${trip.id}`,
        title: trip.title,
        date: trip.departure_date,
        type: "trip",
        color: "bg-accent text-on-accent",
        description: `Inicio del viaje a ${trip.destination}`,
        tripId: trip.id,
        icon: <PaperAirplaneIcon className="h-3 w-3" />,
      });

      if (trip.return_date && trip.return_date !== trip.departure_date) {
        calendarEvents.push({
          id: `trip_end_${trip.id}`,
          title: `Fin - ${trip.title}`,
          date: trip.return_date,
          type: "trip",
          color: "bg-accent-soft text-accent",
          description: `Fin del viaje a ${trip.destination}`,
          tripId: trip.id,
          icon: <PaperAirplaneIcon className="h-3 w-3" />,
        });
      }
    });

    // Eventos de reservas
    bookings.forEach((booking) => {
      calendarEvents.push({
        id: `booking_${booking.id}`,
        title: booking.title,
        date: booking.start_date,
        type: "booking",
        color:
          booking.status === "confirmed"
            ? "bg-success text-on-accent"
            : booking.status === "pending"
              ? "bg-warning text-on-accent"
              : "bg-danger text-on-accent",
        time: booking.start_time,
        description: booking.description,
        tripId: booking.trip_id,
        bookingId: booking.id,
        icon: getEventIcon(booking.type),
      });
    });

    // Eventos de actividades
    activities.forEach((activity) => {
      calendarEvents.push({
        id: `activity_${activity.id}`,
        title: activity.title,
        date: activity.date,
        type: "activity",
        color: "bg-accent-soft text-accent",
        time: activity.start_time,
        description: activity.description,
        tripId: activity.trip_id,
        activityId: activity.id,
        icon: getEventIcon("activity", activity.category),
      });
    });

    setEvents(calendarEvents);
  }, [trips, bookings, activities]);

  // Transformar actividades para el planificador de itinerarios
  const getTripItinerary = useCallback(
    (tripId: string): DayItinerary[] => {
      const tripActivities = activities.filter((a) => a.trip_id === tripId);
      const itineraryMap = new Map<string, PlannerActivity[]>();

      tripActivities.forEach((a) => {
        const activity: PlannerActivity = {
          id: a.id,
          title: a.title,
          description: a.description,
          startTime: a.start_time || "",
          endTime: a.end_time || "",
          category: toPlannerCategory(a.category),
          location: a.location,
          cost: a.cost,
          currency: a.currency,
          notes: a.notes,
          completed: a.completed,
        };

        if (!itineraryMap.has(a.date)) {
          itineraryMap.set(a.date, []);
        }
        itineraryMap.get(a.date)?.push(activity);
      });

      const itinerary: DayItinerary[] = [];
      itineraryMap.forEach((acts, date) => {
        itinerary.push({ date, activities: acts });
      });

      return itinerary;
    },
    [activities],
  );

  // Generar eventos del calendario cuando cambien los datos
  useEffect(() => {
    generateCalendarEvents();
  }, [trips, bookings, activities, generateCalendarEvents]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    // Buscar si hay un viaje activo en esa fecha
    const activeTrip = trips.find((trip) => {
      if (!trip.departure_date) return false;
      const startDate = new Date(trip.departure_date);
      const endDate = trip.return_date ? new Date(trip.return_date) : startDate;
      return date >= startDate && date <= endDate;
    });

    if (activeTrip) {
      setSelectedTrip(activeTrip);
      // Mantener en vista calendario o permitir cambiar, pero no forzar itinerario si falla
      // setViewMode("itinerary"); // Comentado para evitar cambio brusco si falla
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    if (event.type === "trip" && event.tripId) {
      // Redirigir a la página de detalle del viaje
      router.push(`/trips/${event.tripId}`);
    } else if (event.type === "booking" && event.bookingId) {
      // Abrir el modal de edición de reserva
      const booking = bookings.find((b) => b.id === event.bookingId);
      if (booking) {
        setSelectedBooking(booking);
        setShowBookingModal(true);
      }
    } else if (event.type === "activity" && event.tripId) {
      // Ir a la vista de itinerario del viaje
      router.push(`/trips/${event.tripId}`);
    }
  };

  const handleAddEvent = (date: Date) => {
    setSelectedDate(date);
    setSelectedBooking(null); // Asegurarse de que no estamos editando
    setShowBookingModal(true);
  };

  const handleDeleteEvent = (event: CalendarEvent) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar "${event.title}"?`)) {
      return;
    }

    void (async () => {
      try {
        if (event.type === "booking" && event.bookingId) {
          const { data: deletedRows, error } = await withQueryTimeout(
            insforge
              .database.from("bookings")
              .delete()
              .eq("id", event.bookingId)
              .select(),
            { label: "bookings:delete" },
          );

          if (error) throw error;
          assertRowsAffected(deletedRows, "No se pudo eliminar el evento");
        } else if (event.type === "activity" && event.activityId) {
          const { data: deletedRows, error } = await withQueryTimeout(
            insforge
              .database.from("itinerary_activities")
              .delete()
              .eq("id", event.activityId)
              .select(),
            { label: "activities:delete" },
          );

          if (error) throw error;
          assertRowsAffected(deletedRows, "No se pudo eliminar el evento");
        } else if (event.type === "trip" && event.tripId) {
          const { data: deletedRows, error } = await withQueryTimeout(
            insforge
              .database.from("trips")
              .delete()
              .eq("id", event.tripId)
              .select(),
            { label: "trips:delete" },
          );

          if (error) throw error;
          assertRowsAffected(deletedRows, "No se pudo eliminar el evento");
        }

        refetch();
      } catch (error) {
        logger.error("Error deleting event:", error);
        alert(
          queryErrorKind(error) === "timeout"
            ? CONNECTION_TIMEOUT_MESSAGE
            : "Error al eliminar el evento",
        );
      }
    })();
  };

  const filteredBookings = bookings.filter((booking) => {
    const matchesSearch =
      booking.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.confirmation_number
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || booking.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const upcomingBookings = bookings
    .filter((booking) => new Date(booking.start_date) >= new Date())
    .sort(
      (a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
    )
    .slice(0, 5);

  const handleBookingCreated = () => {
    setShowBookingModal(false);
    setSelectedBooking(null);
    refetch();
  };

  const handleEventDrop = async (event: CalendarEvent, newDate: Date) => {
    try {
      // Use date-fns format to get the date string in 'YYYY-MM-DD' format using local time
      // This avoids timezone issues that occur with toISOString()
      const formattedDate = format(newDate, 'yyyy-MM-dd');
      
      // Update local state optimistically
      setEvents(prev => prev.map(e => 
        e.id === event.id ? { ...e, date: formattedDate } : e
      ));

      // Update in DB based on event type
      if (event.type === 'booking' && event.bookingId) {
        const { data: updatedRows, error } = await withQueryTimeout(
          insforge
            .database.from('bookings')
            .update({ start_date: formattedDate })
            .eq('id', event.bookingId)
            .select(),
          { label: 'bookings:move' },
        );
        if (error) throw error;
        assertRowsAffected(updatedRows, 'No se pudo mover el evento');
      } else if (event.type === 'activity' && event.activityId) {
        const { data: updatedRows, error } = await withQueryTimeout(
          insforge
            .database.from('itinerary_activities')
            .update({ date: formattedDate })
            .eq('id', event.activityId)
            .select(),
          { label: 'activities:move' },
        );
        if (error) throw error;
        assertRowsAffected(updatedRows, 'No se pudo mover el evento');
      } else if (event.type === 'trip' && event.tripId) {
        // For trips, we might need to handle end date logic, but for simple move:
        const { data: updatedRows, error } = await withQueryTimeout(
          insforge
            .database.from('trips')
            .update({ departure_date: formattedDate })
            .eq('id', event.tripId)
            .select(),
          { label: 'trips:move' },
        );
        if (error) throw error;
        assertRowsAffected(updatedRows, 'No se pudo mover el evento');
      }

      // Reload data to ensure consistency, but silently (without loading spinner)
      setSilentReload(true);
      refetch();
    } catch (error) {
      console.error('Error updating event date:', error);
      alert(
        queryErrorKind(error) === 'timeout'
          ? CONNECTION_TIMEOUT_MESSAGE
          : 'Error al mover el evento',
      );
      setSilentReload(true); // Revert on error
      refetch();
    }
  };

  // Persistencia por operación del planificador: cada alta, edición y borrado
  // escribe su fila en el momento. El refetch posterior es la única fuente de
  // verdad: el planificador no guarda copia local de las actividades.
  const handleCreateActivity = useCallback(
    async (date: string, activity: PlannerActivityDraft) => {
      const userId = user?.id;
      const tripId = selectedTrip?.id;

      if (!userId || !tripId) {
        throw new Error("No se pudo identificar el viaje o la sesión");
      }

      const orderIndex = activities.filter(
        (a) => a.trip_id === tripId && a.date === date,
      ).length;

      const insforge = createInsforgeClient();
      const { data: insertedRows, error } = await withQueryTimeout(
        insforge
          .database.from("itinerary_activities")
          .insert([
            {
              user_id: userId,
              trip_id: tripId,
              date,
              title: activity.title,
              description: activity.description || null,
              start_time: activity.startTime || null,
              end_time: activity.endTime || null,
              location: activity.location || null,
              category: activity.category,
              cost: activity.cost ?? null,
              currency: activity.currency || "EUR",
              notes: activity.notes || null,
              completed: activity.completed ?? false,
              order_index: orderIndex,
            },
          ])
          .select(),
        { label: "activities:insert" },
      );

      if (error) throw error;
      assertRowsAffected(insertedRows, "No se pudo guardar la actividad");
      refetch();
    },
    [user?.id, selectedTrip?.id, activities, refetch],
  );

  const handleUpdateActivity = useCallback(
    async (activityId: string, activity: PlannerActivityDraft) => {
      const insforge = createInsforgeClient();
      const { data: updatedRows, error } = await withQueryTimeout(
        insforge
          .database.from("itinerary_activities")
          .update({
            title: activity.title,
            description: activity.description || null,
            start_time: activity.startTime || null,
            end_time: activity.endTime || null,
            location: activity.location || null,
            category: activity.category,
            cost: activity.cost ?? null,
            currency: activity.currency || "EUR",
            notes: activity.notes || null,
            completed: activity.completed ?? false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", activityId)
          .select(),
        { label: "activities:update" },
      );

      if (error) throw error;
      assertRowsAffected(updatedRows, "No se pudo actualizar la actividad");
      refetch();
    },
    [refetch],
  );

  const handleDeleteActivity = useCallback(
    async (activityId: string) => {
      const insforge = createInsforgeClient();
      const { data: deletedRows, error } = await withQueryTimeout(
        insforge
          .database.from("itinerary_activities")
          .delete()
          .eq("id", activityId)
          .select(),
        { label: "activities:delete" },
      );

      if (error) throw error;
      assertRowsAffected(deletedRows, "No se pudo eliminar la actividad");
      refetch();
    },
    [refetch],
  );

  if (showSkeleton) {
    return (
      <DashboardLayout>
        <div role="status" aria-busy="true" aria-label="Cargando planificación">
          <PageSkeleton />
          <span className="sr-only">Cargando planificación</span>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div role="alert">
          <ErrorState message={error} onRetry={() => refetch()} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 font-sans">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageTitle
            title="Planificación de Viajes"
            subtitle="Organiza tus viajes, itinerarios y reservas en un solo lugar"
          />

          <div role="group" aria-label="Vistas de planificación" className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-paper p-1">
              <button
                type="button"
                aria-pressed={viewMode === "calendar"}
                onClick={() => setViewMode("calendar")}
                className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:gap-2 sm:px-4 sm:text-sm ${
                  viewMode === "calendar"
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface"
                }`}
              >
                <CalendarIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                Calendario
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "itinerary"}
                onClick={() => setViewMode("itinerary")}
                className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:gap-2 sm:px-4 sm:text-sm ${
                  viewMode === "itinerary"
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface"
                }`}
              >
                <MapIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                Itinerario
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "bookings"}
                onClick={() => setViewMode("bookings")}
                className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:gap-2 sm:px-4 sm:text-sm ${
                  viewMode === "bookings"
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface"
                }`}
              >
                <ClockIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                Reservas
              </button>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-xl border border-line bg-paper p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CalendarIcon className="h-8 w-8 text-accent" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted">
                  Viajes Activos
                </p>
                <p className="text-2xl font-bold text-ink">
                  {
                    trips.filter(
                      (t) =>
                        t.status === "confirmed" || t.status === "in_progress",
                    ).length
                  }
                </p>
              </div>
            </div>
          </Card>

          <Card className="rounded-xl border border-line bg-paper p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-8 w-8 text-success" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted">
                  Reservas Confirmadas
                </p>
                <p className="text-2xl font-bold text-ink">
                  {bookings.filter((b) => b.status === "confirmed").length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="rounded-xl border border-line bg-paper p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <MapIcon className="h-8 w-8 text-accent" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted">
                  Próximas Reservas
                </p>
                <p className="text-2xl font-bold text-ink">
                  {upcomingBookings.length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="rounded-xl border border-line bg-paper p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <PlusIcon className="h-8 w-8 text-accent" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted">
                  Eventos Este Mes
                </p>
                <p className="text-2xl font-bold text-ink">
                  {
                    events.filter((e) => {
                      const eventDate = new Date(e.date);
                      const now = new Date();
                      return (
                        eventDate.getMonth() === now.getMonth() &&
                        eventDate.getFullYear() === now.getFullYear()
                      );
                    }).length
                  }
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Contenido principal */}
        {viewMode === "calendar" && (
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)] lg:gap-6">
            <div className="min-w-0">
              <Calendar
                events={events}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                onEventClick={handleEventClick}
                onAddEvent={handleAddEvent}
                onDeleteEvent={handleDeleteEvent}
                onEventDrop={handleEventDrop}
              />
            </div>

            <div className="space-y-4">
              <Card className="rounded-xl border border-line bg-paper p-4">
                <h3 className="font-semibold text-ink mb-3">
                  Próximas Reservas
                </h3>
                <div className="space-y-3">
                  {upcomingBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="border-l-4 border-success pl-3"
                    >
                      <p className="font-medium text-sm text-ink">
                        {booking.title}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDate(new Date(booking.start_date))}
                        {booking.start_time && ` - ${booking.start_time}`}
                      </p>
                    </div>
                  ))}
                  {upcomingBookings.length === 0 && (
                    <p className="text-sm text-muted">
                      No hay reservas próximas
                    </p>
                  )}
                </div>
              </Card>

              <Card className="rounded-xl border border-line bg-paper p-4">
                <h3 className="font-semibold text-ink mb-3">
                  Viajes Activos
                </h3>
                <div className="space-y-3">
                  {trips
                    .filter(
                      (t) =>
                        t.status === "confirmed" || t.status === "in_progress",
                    )
                    .map((trip) => (
                      <Link
                        key={trip.id}
                        href={`/trips/${trip.id}`}
                        className="block rounded-md border-l-4 border-accent p-3 pl-3 hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <p className="font-medium text-sm text-ink">
                          {trip.title}
                        </p>
                        <p className="text-xs text-muted">
                          {trip.destination}
                        </p>
                        <p className="text-xs text-muted">
                          {formatDate(new Date(trip.departure_date))} -{" "}
                          {trip.return_date
                            ? formatDate(new Date(trip.return_date))
                            : "Sin fecha de regreso"}
                        </p>
                      </Link>
                    ))}
                  {trips.filter(
                    (t) =>
                      t.status === "confirmed" || t.status === "in_progress",
                  ).length === 0 && (
                    <p className="text-sm text-muted">
                      No hay viajes activos
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {viewMode === "itinerary" && (
          <div>
            {selectedTrip ? (
              <div>
                <div className="mb-6">
                  <Button
                    variant="outline"
                    onClick={() => setViewMode("calendar")}
                    className="mb-4 min-h-11"
                  >
                    Volver al calendario
                  </Button>
                  <h2 className="font-sans text-xl font-semibold text-ink">
                    Itinerario: {selectedTrip.title}
                  </h2>
                  <p className="text-muted">{selectedTrip.destination}</p>
                </div>

                <ItineraryPlanner
                  startDate={selectedTrip.departure_date}
                  endDate={
                    selectedTrip.return_date || selectedTrip.departure_date
                  }
                  itinerary={getTripItinerary(selectedTrip.id)}
                  onCreateActivity={handleCreateActivity}
                  onUpdateActivity={handleUpdateActivity}
                  onDeleteActivity={handleDeleteActivity}
                />
              </div>
            ) : (
                <div className="rounded-xl border border-line bg-paper px-5 py-10 text-center">
                {trips.length === 0 ? (
                  <div role="status" aria-live="polite">
                    <MapIcon aria-hidden="true" className="mx-auto mb-4 h-12 w-12 text-accent" />
                    <h3 className="font-sans text-lg font-semibold text-ink">
                      Aún no tienes viajes para planificar
                    </h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                      Crea un viaje para organizar su itinerario y tener sus reservas junto a las fechas.
                    </p>
                    <Link href="/trips/new" className={`${accentLinkClassName} mt-5 min-h-11`}>
                      Crear un viaje
                    </Link>
                  </div>
                ) : (
                  <>
                <MapIcon className="h-12 w-12 text-muted mx-auto mb-4" />
                <h3 className="text-lg font-medium text-ink mb-2">
                  Selecciona un viaje
                </h3>
                <p className="text-muted mb-4">
                  Elige un viaje para planificar su itinerario detallado
                </p>
                <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {trips.map((trip) => (
                    <Card key={trip.id} className="rounded-xl border border-line bg-paper">
                      <button
                        type="button"
                        className="min-h-11 w-full rounded-xl p-4 text-left hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                        onClick={() => setSelectedTrip(trip)}
                      >
                        <span className="block font-semibold text-ink">{trip.title}</span>
                        <span className="mt-1 block text-sm text-muted">{trip.destination}</span>
                        <span className="mt-2 block text-xs text-muted">
                          {formatDate(new Date(trip.departure_date))} -{" "}
                          {trip.return_date
                            ? formatDate(new Date(trip.return_date))
                            : "Sin fecha de regreso"}
                        </span>
                      </button>
                    </Card>
                  ))}
                </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {viewMode === "bookings" && (
          <div className="space-y-6">
            {/* Filtros y búsqueda */}
            <section aria-label="Filtros de reservas" className="rounded-xl border border-line bg-paper p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Input
                  label="Buscar reservas"
                  type="search"
                  placeholder="Título o código de confirmación"
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchTerm(e.target.value)
                  }
                  className="min-h-11"
                />
              </div>

              <div className="flex items-center gap-2 sm:w-56">
                <FunnelIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
                <select
                  value={filterStatus}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFilterStatus(e.target.value)
                  }
                  aria-label="Filtrar por estado"
                  className={cn(fieldClassName, 'min-h-11 min-w-0 flex-1')}
                >
                  <option value="all">Todos los estados</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="pending">Pendiente</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              </div>
            </section>

            {/* Lista de reservas */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {filteredBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onEdit={() => {
                    setSelectedBooking(booking);
                    setShowBookingModal(true);
                  }}
                  onDelete={(id) => {
                    setBookings((prev) => prev.filter((b) => b.id !== id));
                  }}
                  onStatusChange={(id, status) => {
                    setBookings((prev) =>
                      prev.map((b) => (b.id === id ? { ...b, status } : b)),
                    );
                  }}
                />
              ))}
            </div>

            {filteredBookings.length === 0 && (
              <div role="status" aria-live="polite" className="rounded-xl border border-dashed border-line bg-paper px-5 py-12 text-center">
                <ClockIcon aria-hidden="true" className="h-12 w-12 text-muted mx-auto mb-4" />
                <h3 className="font-sans text-lg font-semibold text-ink mb-2">
                  {searchTerm || filterStatus !== "all"
                    ? "No hay reservas que coincidan con los filtros"
                    : trips.length === 0
                      ? "Crea un viaje antes de añadir una reserva"
                      : "No tienes reservas todavía"}
                </h3>
                <p className="text-muted mb-4">
                  {searchTerm || filterStatus !== "all"
                    ? "Prueba otro término o cambia el estado seleccionado."
                    : trips.length === 0
                      ? "Cada reserva necesita estar asociada a uno de tus viajes."
                      : "Añade tus reservas para tenerlas junto a las fechas del viaje."}
                </p>
                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                  {(searchTerm || filterStatus !== "all") && (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => {
                        setSearchTerm("");
                        setFilterStatus("all");
                      }}
                    >
                      Limpiar filtros
                    </Button>
                  )}
                  {trips.length === 0 && !searchTerm && filterStatus === "all" ? (
                    <Link href="/trips/new" className={`${accentLinkClassName} min-h-11`}>
                      Crear un viaje
                    </Link>
                  ) : (
                    <Button
                      type="button"
                      className="min-h-11"
                      onClick={() => {
                        setSelectedBooking(null);
                        setShowBookingModal(true);
                      }}
                    >
                      <PlusIcon aria-hidden="true" className="mr-2 h-4 w-4" />
                      Nueva reserva
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal para nueva reserva */}
        {showBookingModal && (
          <Modal
            isOpen={showBookingModal}
            onClose={() => {
              setShowBookingModal(false);
              setSelectedBooking(null);
            }}
            title={selectedBooking ? "Editar Reserva" : "Nueva Reserva"}
          >
            <div className="p-6">
              <NewBookingForm
                onSuccess={handleBookingCreated}
                onCancel={() => {
                  setShowBookingModal(false);
                  setSelectedBooking(null);
                }}
                initialData={selectedBooking}
                defaultDate={selectedDate}
              />
            </div>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
}
