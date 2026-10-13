import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  TrashIcon
} from '@heroicons/react/24/outline';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday,
  addWeeks,
  subWeeks,
} from 'date-fns';
import { es } from 'date-fns/locale';
import Button from '../ui/Button';
import { 
  DndContext, 
  useDraggable, 
  useDroppable, 
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  DragOverlay,
  DragStartEvent
} from '@dnd-kit/core';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'trip' | 'activity' | 'booking' | 'reminder' | 'task';
  color: string;
  time?: string;
  description?: string;
  tripId?: string;
  bookingId?: string;
  activityId?: string;
  icon?: React.ReactNode;
}

interface CalendarProps {
  events?: CalendarEvent[];
  onDateSelect?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onAddEvent?: (date: Date) => void;
  onDeleteEvent?: (event: CalendarEvent) => void;
  onEventDrop?: (event: CalendarEvent, newDate: Date) => void;
  selectedDate?: Date;
  className?: string;
}

// La clave de dia del calendario es 'yyyy-MM-dd', la misma que usan el esquema y
// el planificador (commit 9883438). PostgREST devuelve las columnas
// `timestamptz` con hora y desfase (`2026-09-20T00:00:00+00:00`), que nunca
// iguala una fecha de dia; se toma el dia tal cual viene, sin pasar por la zona
// horaria local, que en zonas al oeste de UTC desplazaria el evento de jornada.
const toDayKey = (value: string) => value.slice(0, 10);

const LONG_PRESS_MS = 500;

const DraggableEvent = ({
  event,
  onClick,
  onContextMenu,
  onOpenMenu,
  isDragging = false
}: {
  event: CalendarEvent;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onOpenMenu?: (event: CalendarEvent, x: number, y: number, returnFocusTo?: HTMLElement) => void;
  isDragging?: boolean;
}) => {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: event.id,
    data: event
  });
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressAt = useRef(0);

  const setRefs = (node: HTMLDivElement | null) => {
    nodeRef.current = node;
    setNodeRef(node);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => cancelLongPress, []);

  // El menu de borrado solo se abria con el clic derecho, que no existe ni en tactil ni con
  // teclado: se le dan sus dos equivalentes, Mayus+F10 / tecla de menu y pulsacion larga.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
      e.preventDefault();
      e.stopPropagation();
      const rect = nodeRef.current?.getBoundingClientRect();
      if (rect) onOpenMenu?.(event, rect.left, rect.bottom, nodeRef.current ?? undefined);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const { clientX, clientY } = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      longPressAt.current = Date.now();
      onOpenMenu?.(event, clientX, clientY, nodeRef.current ?? undefined);
    }, LONG_PRESS_MS);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Despues de la pulsacion larga el navegador emite un clic: no debe abrir el evento.
    if (Date.now() - longPressAt.current < 800) {
      e.stopPropagation();
      return;
    }
    onClick?.(e);
  };

  return (
    <div
      ref={setRefs}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      onContextMenu={onContextMenu}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onTouchCancel={cancelLongPress}
      aria-label={`${event.title}${event.time ? `, ${event.time.substring(0, 5)}` : ''}${event.description ? `, ${event.description}` : ''}`}
      className={`
        group flex min-h-11 min-w-0 items-center gap-1 rounded-md border border-ink/10 px-1.5 py-1
        cursor-grab shadow-sm transition-colors hover:brightness-95 active:cursor-grabbing
        ${event.color} relative
        ${isDragging ? 'opacity-30' : ''}
      `}
      title={`${event.title}${event.time ? ` - ${event.time}` : ''}\n${event.description || ''}`}
    >
      {event.icon && (
        <span className="flex-shrink-0 text-current/90">
          {event.icon}
        </span>
      )}
      {event.time && (
        <span className="hidden whitespace-nowrap text-xs font-semibold text-current sm:inline">
          {event.time.substring(0, 5)}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-current">
        {event.title}
      </span>
    </div>
  );
};

// Componente para el Overlay (visualización mientras se arrastra)
const EventOverlay = ({ event }: { event: CalendarEvent }) => {
  return (
    <div
      className={`
        flex items-center gap-1 p-1 rounded shadow-lg
        ${event.color} border-l-2 border-white/20
        w-[150px] opacity-90 pointer-events-none cursor-grabbing
      `}
    >
      {event.icon && (
        <span className="flex-shrink-0 text-current/90">
          {event.icon}
        </span>
      )}
      {event.time && (
        <span className="whitespace-nowrap text-xs font-semibold text-current">
          {event.time.substring(0, 5)}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-current">
        {event.title}
      </span>
    </div>
  );
};

const DroppableDay = ({ 
  day, 
  children, 
  className, 
  onClick, 
  onDoubleClick 
}: { 
  day: Date; 
  children: React.ReactNode; 
  className?: string; 
  onClick?: () => void; 
  onDoubleClick?: (e: any) => void 
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: day.toISOString(),
    data: { date: day }
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'bg-accent-soft ring-2 ring-inset ring-accent' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </div>
  );
};

export const Calendar: React.FC<CalendarProps> = ({
  events = [],
  onDateSelect,
  onEventClick,
  onAddEvent,
  onDeleteEvent,
  onEventDrop,
  selectedDate,
  className = ''
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, event: CalendarEvent } | null>(null);
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const contextReturnRef = useRef<HTMLElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    // Sin este sensor el teclado no puede mover eventos: con el, Espacio/Enter coge el evento,
    // las flechas lo desplazan y Esc cancela.
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // El menu se abre desde el final del calendario, asi que sin llevar el foco a su primera
  // accion no habria forma de alcanzarlo con Tab cuando se abre con el teclado.
  useEffect(() => {
    if (contextMenu) menuButtonRef.current?.focus();
  }, [contextMenu]);

  // El menu se coloca con coordenadas del puntero. A 360px un clic cerca del borde derecho o
  // inferior lo dejaba fuera de la pantalla, asi que se limita al viewport.
  const openEventMenu = (event: CalendarEvent, x: number, y: number, returnFocusTo?: HTMLElement) => {
    contextReturnRef.current = returnFocusTo ?? null;
    const menu = { width: 160, height: 44 };
    setContextMenu({
      x: Math.max(8, Math.min(x, window.innerWidth - menu.width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - menu.height - 8)),
      event,
    });
  };

  const handleContextMenu = (e: React.MouseEvent, event: CalendarEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openEventMenu(event, e.clientX, e.clientY, e.currentTarget as HTMLElement);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveEvent(active.data.current as CalendarEvent);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.data.current) {
      const draggedEvent = active.data.current as CalendarEvent;
      const newDate = (over.data.current as { date: Date }).date;
      
      // Use format from date-fns to ensure correct string comparison
      // The date string in event.date should match the format we compare against
      const newDateStr = format(newDate, 'yyyy-MM-dd');

      if (draggedEvent.date !== newDateStr) {
        onEventDrop?.(draggedEvent, newDate);
      }
    }
    setActiveEvent(null);
  };

  // Navegación
  const next = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const prev = () => {
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Generación de días
  const getDays = () => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(monthStart);
      const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Lunes
      const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
      
      return eachDayOfInterval({ start: startDate, end: endDate });
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
  };

  // Los eventos llegan con la fecha tal cual la devuelve PostgREST (los viajes,
  // por ejemplo, con un `timestamptz` completo). Se normalizan una sola vez al
  // entrar para que el filtro por dia y el arrastre usen la misma clave.
  const normalizedEvents = useMemo(
    () => events.map(event => ({ ...event, date: toDayKey(event.date) })),
    [events]
  );

  const days = getDays();
  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // Filtrar eventos
  const getEventsForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return normalizedEvents.filter(event => event.date === dayStr);
  };

  const hasEventsInPeriod = days.some((day) => getEventsForDay(day).length > 0);

  const renderMonthView = () => (
    <div className="grid grid-cols-1 border-l border-t border-line bg-surface sm:grid-cols-7">
      {days.map((day) => {
        const dayEvents = getEventsForDay(day);
        const isSelected = selectedDate && isSameDay(day, selectedDate);
        const isTodayDay = isToday(day);
        const isCurrentMonth = isSameMonth(day, currentDate);

        return (
          <DroppableDay
            key={day.toISOString()}
            day={day}
            className={`
              relative grid min-h-[4.5rem] grid-cols-[5rem_minmax(0,1fr)] gap-2 border-r border-b border-line p-2
              transition-colors hover:bg-surface-strong sm:block sm:min-h-[120px]
              ${!isCurrentMonth ? 'bg-surface-strong/50 text-muted' : 'text-ink'}
              ${isSelected ? 'bg-accent-soft/50' : ''}
            `}
            onClick={() => onDateSelect?.(day)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onAddEvent?.(day);
            }}
          >
            <div className="flex items-start gap-1 sm:mb-2 sm:justify-between">
              <span className="sm:hidden text-xs font-medium capitalize">
                {format(day, 'EEE', { locale: es })}
              </span>
              <button
                type="button"
                aria-label={`Seleccionar el ${format(day, "EEEE d 'de' MMMM yyyy", { locale: es })}`}
                aria-pressed={Boolean(isSelected)}
                onClick={(event) => {
                  event.stopPropagation();
                  onDateSelect?.(day);
                }}
                className={`
                  inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-sm font-medium
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1
                  ${isTodayDay ? 'bg-accent text-on-accent shadow-sm' : ''}
                `}
              >
                {format(day, 'd')}
              </button>
            </div>
            
            <div className="min-w-0 space-y-1 sm:max-h-[90px] sm:overflow-y-auto">
              {dayEvents.map(event => (
                <DraggableEvent
                  key={event.id}
                  event={event}
                  isDragging={activeEvent?.id === event.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick?.(event);
                  }}
                  onContextMenu={(e) => handleContextMenu(e, event)}
                  onOpenMenu={openEventMenu}
                />
              ))}
            </div>
          </DroppableDay>
        );
      })}
    </div>
  );

  const renderWeekView = () => (
    <div className="grid grid-cols-1 border-l border-t border-line bg-surface sm:grid-cols-7">
      {days.map((day) => {
        const dayEvents = getEventsForDay(day);
        const isTodayDay = isToday(day);

        return (
          <DroppableDay
            key={day.toISOString()}
            day={day}
            className={`
              relative grid min-h-[4.5rem] grid-cols-[5rem_minmax(0,1fr)] gap-2 border-r border-b border-line p-2
              sm:block sm:min-h-[300px] sm:overflow-y-auto
              ${isTodayDay ? 'bg-accent-soft/30' : ''}
            `}
            onClick={() => onDateSelect?.(day)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onAddEvent?.(day);
            }}
          >
             <div className="flex items-center gap-1 border-b border-line pb-1 sm:sticky sm:top-0 sm:mb-4 sm:justify-center sm:bg-inherit sm:pb-2">
               <span className="text-xs text-muted uppercase sm:mb-1 sm:block">
                 {format(day, 'EEE', { locale: es })}
               </span>
               <button
                 type="button"
                 aria-label={`Seleccionar el ${format(day, "EEEE d 'de' MMMM yyyy", { locale: es })}`}
                 aria-pressed={Boolean(selectedDate && isSameDay(day, selectedDate))}
                 onClick={(event) => {
                   event.stopPropagation();
                   onDateSelect?.(day);
                 }}
                 className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                   isTodayDay ? 'bg-accent text-on-accent' : 'text-ink'
                 }`}
               >
                 {format(day, 'd')}
               </button>
             </div>
             
             <div className="space-y-2">
               {dayEvents
                 .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                 .map(event => (
                   <DraggableEvent
                     key={event.id}
                     event={event}
                     isDragging={activeEvent?.id === event.id}
                     onClick={(e) => {
                       e.stopPropagation();
                       onEventClick?.(event);
                     }}
                     onContextMenu={(e) => handleContextMenu(e, event)}
                     onOpenMenu={openEventMenu}
                   />
                 ))}
             </div>
          </DroppableDay>
        );
      })}
    </div>
  );

  return (
    <DndContext 
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <section aria-label="Calendario de viajes" className={`overflow-hidden rounded-xl border border-line bg-paper font-sans shadow-sm ${className}`}>
        {/* Header */}
        <div className="flex flex-col gap-3 p-4 border-b border-line sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <h2 className="min-w-0 flex-1 font-sans text-lg font-bold capitalize text-ink sm:text-xl">
              {format(currentDate, 'MMMM yyyy', { locale: es })}
            </h2>
            <div className="flex shrink-0 items-center rounded-md border border-line bg-paper">
              <button
                type="button"
                aria-label="Mes anterior"
                onClick={prev}
                className="inline-flex min-h-11 min-w-11 items-center justify-center border-r border-line text-ink hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ChevronLeftIcon aria-hidden="true" className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Ir al día de hoy"
                onClick={goToToday}
                className="min-h-11 px-3 text-sm font-medium text-ink hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Hoy
              </button>
              <button
                type="button"
                aria-label="Mes siguiente"
                onClick={next}
                className="inline-flex min-h-11 min-w-11 items-center justify-center border-l border-line text-ink hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ChevronRightIcon aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 rounded-lg border border-line bg-surface p-1 sm:w-fit">
            <button
              type="button"
              aria-pressed={viewMode === 'month'}
              onClick={() => setViewMode('month')}
              className={`
                min-h-11 rounded-md px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                ${viewMode === 'month' 
                  ? 'bg-accent-soft text-accent'
                  : 'text-muted hover:text-ink'}
              `}
            >
              Mes
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'week'}
              onClick={() => setViewMode('week')}
              className={`
                min-h-11 rounded-md px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                ${viewMode === 'week' 
                  ? 'bg-accent-soft text-accent'
                  : 'text-muted hover:text-ink'}
              `}
            >
              Semana
            </button>
          </div>
        </div>

        {onAddEvent && (
          <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              Día seleccionado: <span className="font-medium text-ink">{format(selectedDate ?? new Date(), "d 'de' MMMM yyyy", { locale: es })}</span>
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => onAddEvent(selectedDate ?? new Date())}
            >
              <span aria-hidden="true" className="mr-2 text-lg leading-none">+</span>
              Añadir evento al día seleccionado
            </Button>
          </div>
        )}

        <div>
            {/* Días de la semana (Header) */}
            <div className="hidden grid-cols-7 border-b border-line bg-surface-strong/50 sm:grid">
              {weekDays.map(day => (
                <div
                  key={day}
                  className="py-3 text-center text-xs font-semibold text-muted uppercase tracking-wider"
                >
                  {day}
                </div>
              ))}
            </div>

            {!hasEventsInPeriod && (
              <p role="status" className="border-b border-line bg-paper px-4 py-3 text-sm text-muted">
                No hay eventos en este periodo. Selecciona un día para añadir uno.
              </p>
            )}

            {/* Vistas */}
            {viewMode === 'month' ? renderMonthView() : renderWeekView()}
        </div>
        
        {/* Footer Leyenda */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line bg-surface px-4 py-4 text-xs sm:gap-6 sm:px-6">
          {[
            { label: 'Viajes', color: 'bg-accent' },
            { label: 'Reservas confirmadas', color: 'bg-success' },
            { label: 'Reservas pendientes', color: 'bg-warning' },
            { label: 'Actividades', color: 'bg-accent-soft' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${item.color} ring-2 ring-paper`} />
              <span className="font-medium text-muted">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <div
            role="menu"
            aria-label={`Acciones de ${contextMenu.event.title}`}
            className="fixed z-50 w-40 rounded-md border border-line bg-paper py-1 text-ink shadow-lg"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setContextMenu(null);
                contextReturnRef.current?.focus();
              }
            }}
          >
            <button
              ref={menuButtonRef}
              role="menuitem"
              className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm text-danger hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteEvent?.(contextMenu.event);
                setContextMenu(null);
              }}
            >
              <TrashIcon className="h-4 w-4" aria-hidden="true" />
              Eliminar
            </button>
          </div>
        )}

        {/* Drag Overlay */}
        <DragOverlay>
          {activeEvent ? <EventOverlay event={activeEvent} /> : null}
        </DragOverlay>
      </section>
    </DndContext>
  );
};
