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
  parseISO
} from 'date-fns';
import { es } from 'date-fns/locale';
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
  onOpenMenu?: (event: CalendarEvent, x: number, y: number) => void;
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
      if (rect) onOpenMenu?.(event, rect.left, rect.bottom);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const { clientX, clientY } = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      longPressAt.current = Date.now();
      onOpenMenu?.(event, clientX, clientY);
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
      className={`
        group flex items-center gap-1 p-1 rounded cursor-grab active:cursor-grabbing
        hover:opacity-90 transition-all shadow-sm mb-1
        ${event.color} border-l-2 border-white/20 relative
        ${isDragging ? 'opacity-30' : ''}
      `}
      title={`${event.title}${event.time ? ` - ${event.time}` : ''}\n${event.description || ''}`}
    >
      {event.icon && (
        <span className="text-white/90 flex-shrink-0 w-3 h-3">
          {event.icon}
        </span>
      )}
      {event.time && (
        <span className="text-[10px] font-medium opacity-90 whitespace-nowrap bg-black/10 px-1 rounded">
          {event.time.substring(0, 5)}
        </span>
      )}
      <span className="text-xs font-medium truncate flex-1 text-white">
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
        <span className="text-white/90 flex-shrink-0 w-3 h-3">
          {event.icon}
        </span>
      )}
      {event.time && (
        <span className="text-[10px] font-medium opacity-90 whitespace-nowrap bg-black/10 px-1 rounded">
          {event.time.substring(0, 5)}
        </span>
      )}
      <span className="text-xs font-medium truncate flex-1 text-white">
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
  const openEventMenu = (event: CalendarEvent, x: number, y: number) => {
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
    openEventMenu(event, e.clientX, e.clientY);
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

  const renderMonthView = () => (
    <div className="grid grid-cols-7 border-l border-t border-line bg-surface">
      {days.map((day, idx) => {
        const dayEvents = getEventsForDay(day);
        const isSelected = selectedDate && isSameDay(day, selectedDate);
        const isTodayDay = isToday(day);
        const isCurrentMonth = isSameMonth(day, currentDate);

        return (
          <DroppableDay
            key={day.toISOString()}
            day={day}
            className={`
              min-h-[120px] p-2 border-r border-b border-line cursor-pointer 
              transition-colors relative hover:bg-surface-strong
              ${!isCurrentMonth ? 'bg-surface-strong/50 text-muted' : 'text-ink'}
              ${isSelected ? 'bg-accent-soft/50' : ''}
            `}
            onClick={() => onDateSelect?.(day)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onAddEvent?.(day);
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={`
                  text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                  ${isTodayDay ? 'bg-accent text-on-accent shadow-sm' : ''}
                `}
              >
                {format(day, 'd')}
              </span>
            </div>
            
            <div className="space-y-1 overflow-y-auto max-h-[90px] custom-scrollbar">
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
    <div className="grid grid-cols-7 border-l border-t border-line bg-surface h-[600px]">
      {days.map((day) => {
        const dayEvents = getEventsForDay(day);
        const isTodayDay = isToday(day);

        return (
          <DroppableDay
            key={day.toISOString()}
            day={day}
            className={`
              border-r border-b border-line p-2 overflow-y-auto
              ${isTodayDay ? 'bg-accent-soft/30' : ''}
            `}
            onClick={() => onDateSelect?.(day)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onAddEvent?.(day);
            }}
          >
             <div className="text-center mb-4 sticky top-0 bg-inherit pb-2 border-b border-line">
               <span className="text-xs text-muted uppercase block mb-1">
                 {format(day, 'EEE', { locale: es })}
               </span>
               <span className={`
                 inline-flex items-center justify-center w-8 h-8 rounded-full text-lg font-semibold
                 ${isTodayDay ? 'bg-accent text-on-accent' : 'text-ink'}
               `}>
                 {format(day, 'd')}
               </span>
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
      <div className={`bg-surface rounded-xl shadow-sm border border-line overflow-hidden ${className}`}>
        {/* Header */}
        <div className="flex flex-col gap-3 p-4 border-b border-line sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <h2 className="text-lg font-bold text-ink capitalize sm:text-xl sm:min-w-[200px]">
              {format(currentDate, 'MMMM yyyy', { locale: es })}
            </h2>
            <div className="flex items-center rounded-md border border-line bg-surface shadow-sm">
              <button
                onClick={prev}
                className="p-1.5 hover:bg-surface-strong text-muted border-r border-line"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-strong"
              >
                Hoy
              </button>
              <button
                onClick={next}
                className="p-1.5 hover:bg-surface-strong text-muted border-l border-line"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex rounded-lg border border-line p-1 bg-surface-strong">
            <button
              onClick={() => setViewMode('month')}
              className={`
                flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-md transition-all
                ${viewMode === 'month' 
                  ? 'bg-surface text-accent shadow-sm' 
                  : 'text-muted hover:text-ink'}
              `}
            >
              Mes
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`
                flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-md transition-all
                ${viewMode === 'week' 
                  ? 'bg-surface text-accent shadow-sm' 
                  : 'text-muted hover:text-ink'}
              `}
            >
              Semana
            </button>
          </div>
        </div>

        {/* A 360px, siete columnas de 1fr dan 51px por dia y el titulo del evento no cabe. Se
            conserva la rejilla de 7 y se permite desplazar en horizontal, con una columna minima
            de 91px. En escritorio el ancho disponible supera el minimo y no hay desplazamiento. */}
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Días de la semana (Header) */}
            <div className="grid grid-cols-7 border-b border-line bg-surface-strong/50">
              {weekDays.map(day => (
                <div
                  key={day}
                  className="py-3 text-center text-xs font-semibold text-muted uppercase tracking-wider"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Vistas */}
            {viewMode === 'month' ? renderMonthView() : renderWeekView()}
          </div>
        </div>
        
        {/* Footer Leyenda */}
        <div className="px-6 py-4 border-t border-line bg-surface-strong/30 flex flex-wrap gap-6 text-xs">
          {[
            { label: 'Viajes', color: 'bg-blue-500' },
            { label: 'Reservas', color: 'bg-green-500' },
            { label: 'Pendiente', color: 'bg-orange-500' },
            { label: 'Actividades', color: 'bg-purple-500' },
            { label: 'Tareas', color: 'bg-emerald-500' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${item.color} ring-2 ring-surface shadow-sm`} />
              <span className="font-medium text-muted">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <div
            role="menu"
            aria-label={`Acciones de ${contextMenu.event.title}`}
            className="fixed w-40 bg-surface border border-line shadow-lg rounded-md py-1 z-50"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setContextMenu(null);
              }
            }}
          >
            <button
              ref={menuButtonRef}
              role="menuitem"
              className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-danger/10 flex items-center gap-2"
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
      </div>
    </DndContext>
  );
};
