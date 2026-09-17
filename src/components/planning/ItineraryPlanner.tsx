'use client';

import React, { useState } from 'react';
import {
  PlusIcon,
  ClockIcon,
  MapPinIcon,
  TrashIcon,
  PencilIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { textareaClassName, selectClassName } from '../ui/fieldStyles';
import CategoryIcon from '../ui/CategoryIcon';
import { Card } from '../ui/Card';
import {
  formatDate,
  cn,
  CONNECTION_TIMEOUT_MESSAGE,
  getErrorMessage,
} from '../../lib/utils';
import { queryErrorKind } from '../../lib/insforge-query';
import { logger } from '@/lib/logger';

const ACTIVITY_CATEGORIES = [
  { value: 'transport', label: 'Transporte', color: 'bg-blue-100 text-blue-800' },
  { value: 'accommodation', label: 'Alojamiento', color: 'bg-purple-100 text-purple-800' },
  { value: 'food', label: 'Comida', color: 'bg-orange-100 text-orange-800' },
  { value: 'activity', label: 'Actividad', color: 'bg-green-100 text-green-800' },
  { value: 'shopping', label: 'Compras', color: 'bg-pink-100 text-pink-800' },
  { value: 'other', label: 'Otro', color: 'bg-gray-100 text-gray-800' }
] as const;

export type PlannerCategory = (typeof ACTIVITY_CATEGORIES)[number]['value'];

// La columna `category` del esquema es `text` y admite valores fuera de esta
// lista (por defecto 'general'). Traducir con esta guarda evita un cast a la
// union y deja el valor por defecto en 'other'.
export function toPlannerCategory(value?: string | null): PlannerCategory {
  return ACTIVITY_CATEGORIES.find((category) => category.value === value)?.value ?? 'other';
}

// `id` es siempre el uuid de la fila persistida. No hay ids sinteticos: las
// filas nuevas solo existen en el servidor y llegan por el `itinerary` del
// padre tras el refetch. Editar y borrar mandan ese uuid, nunca uno inventado.
export interface PlannerActivity {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  category: PlannerCategory;
  cost?: number;
  currency?: string;
  notes?: string;
  completed?: boolean;
}

export type PlannerActivityDraft = Omit<PlannerActivity, 'id'>;

export interface DayItinerary {
  date: string;
  activities: PlannerActivity[];
}

interface ItineraryPlannerProps {
  startDate: string;
  endDate: string;
  itinerary?: DayItinerary[];
  onCreateActivity: (date: string, activity: PlannerActivityDraft) => Promise<void>;
  onUpdateActivity: (activityId: string, activity: PlannerActivityDraft) => Promise<void>;
  onDeleteActivity: (activityId: string) => Promise<void>;
  className?: string;
}

interface SaveOperation {
  kind: 'create' | 'update' | 'delete';
  activityId: string;
}

export const ItineraryPlanner: React.FC<ItineraryPlannerProps> = ({
  startDate,
  endDate,
  itinerary = [],
  onCreateActivity,
  onUpdateActivity,
  onDeleteActivity,
  className = ''
}) => {
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [editingActivity, setEditingActivity] = useState<PlannerActivity | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<SaveOperation | null>(null);
  const [saveError, setSaveError] = useState('');

  // Generar días del viaje
  const generateTripDays = (): string[] => {
    try {
      if (!startDate || !endDate) return [];
      // Las fechas del viaje llegan como 'yyyy-MM-dd'; se parsean en local para
      // que la clave del día sea la misma cadena ISO que usa el esquema y el
      // mapeo de `itinerary`, y no una fecha localizada que nunca casaría.
      const start = parseISO(startDate);
      const end = parseISO(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

      // Limit range to prevent infinite loops or huge arrays
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 365) return []; // Limit to 1 year

      const days: string[] = [];
      for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        days.push(format(date, 'yyyy-MM-dd'));
      }

      return days;
    } catch (e) {
      console.error("Error generating trip days", e);
      return [];
    }
  };

  const tripDays = generateTripDays();

  // Obtener itinerario de un día específico
  const getDayItinerary = (date: string): DayItinerary => {
    return itinerary.find(day => day.date === date) || {
      date,
      activities: []
    };
  };

  const runOperation = async (
    operation: SaveOperation,
    action: () => Promise<void>,
  ): Promise<boolean> => {
    setSaveError('');
    setSaving(operation);

    try {
      await action();
      return true;
    } catch (err) {
      const message =
        queryErrorKind(err) === 'timeout'
          ? CONNECTION_TIMEOUT_MESSAGE
          : getErrorMessage(err, 'Error al guardar la actividad');
      logger.error('ItineraryPlanner: no se pudo guardar la actividad', {
        error: message,
      });
      setSaveError(message);
      return false;
    } finally {
      setSaving(null);
    }
  };

  const closeActivityModal = () => {
    setIsAddingActivity(false);
    setEditingActivity(null);
    setSelectedDay('');
  };

  const handleActivitySubmit = async (draft: PlannerActivityDraft) => {
    if (editingActivity) {
      const ok = await runOperation(
        { kind: 'update', activityId: editingActivity.id },
        () => onUpdateActivity(editingActivity.id, draft),
      );
      if (ok) closeActivityModal();
      return;
    }

    const ok = await runOperation(
      { kind: 'create', activityId: '' },
      () => onCreateActivity(selectedDay, draft),
    );
    if (ok) closeActivityModal();
  };

  const handleActivityDelete = (activity: PlannerActivity) => {
    void runOperation(
      { kind: 'delete', activityId: activity.id },
      () => onDeleteActivity(activity.id),
    );
  };

  // Toggle expandir día
  const toggleDayExpanded = (date: string) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  // Obtener categoría de actividad
  const getActivityCategory = (category: PlannerCategory) => {
    return ACTIVITY_CATEGORIES.find(cat => cat.value === category) || ACTIVITY_CATEGORIES[5];
  };

  // Calcular costo total del día
  const getDayTotalCost = (activities: PlannerActivity[]) => {
    return activities.reduce((total, activity) => total + (activity.cost || 0), 0);
  };

  const isSaving = saving !== null;
  const isActivityModalOpen = isAddingActivity || editingActivity !== null;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Planificador de Itinerario</h2>
        <p className="text-gray-600">
          {formatDate(new Date(startDate))} - {formatDate(new Date(endDate))}
        </p>
      </div>

      {saveError && !isActivityModalOpen && (
        <div role="alert" className="text-danger text-sm bg-danger/10 p-2 rounded">
          {saveError}
        </div>
      )}

      {/* Días del viaje */}
      <div className="space-y-4">
        {tripDays.map((date, index) => {
          const dayItinerary = getDayItinerary(date);
          const isExpanded = expandedDays.has(date);
          const dayDate = parseISO(date);
          const dayName = dayDate.toLocaleDateString('es-ES', { weekday: 'long' });
          const totalCost = getDayTotalCost(dayItinerary.activities);

          return (
            <Card key={date} className="overflow-hidden">
              {/* Header del día */}
              <div
                className="p-4 bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleDayExpanded(date)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {isExpanded ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          Día {index + 1} - {dayName}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {formatDate(dayDate)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        {dayItinerary.activities.length} actividades
                      </p>
                      {totalCost > 0 && (
                        <p className="text-sm font-medium text-gray-900">
                          ${totalCost.toFixed(2)}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSaving}
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        setSelectedDay(date);
                        setIsAddingActivity(true);
                      }}
                    >
                      <PlusIcon className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Contenido del día */}
              {isExpanded && (
                <div className="p-4 space-y-4">
                  {/* Actividades */}
                  {dayItinerary.activities.length > 0 ? (
                    <div className="space-y-3">
                      {dayItinerary.activities.map(activity => {
                        const category = getActivityCategory(activity.category);

                        return (
                          <div
                            key={activity.id}
                            className="flex items-start space-x-3 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                          >
                            <div className="flex-shrink-0">
                              <CategoryIcon
                                category={category.value}
                                className="h-5 w-5 text-gray-600"
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900">
                                    {activity.title}
                                  </h4>
                                  {activity.description && (
                                    <p className="text-sm text-gray-600 mt-1">
                                      {activity.description}
                                    </p>
                                  )}

                                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                    <div className="flex items-center space-x-1">
                                      <ClockIcon className="h-4 w-4" />
                                      <span>{activity.startTime} - {activity.endTime}</span>
                                    </div>
                                    {activity.location && (
                                      <div className="flex items-center space-x-1">
                                        <MapPinIcon className="h-4 w-4" />
                                        <span>{activity.location}</span>
                                      </div>
                                    )}
                                    {activity.cost && (
                                      <span className="font-medium text-gray-900">
                                        ${activity.cost}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center space-x-2 ml-4">
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${category.color}`}>
                                    {category.label}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Editar ${activity.title}`}
                                    disabled={isSaving}
                                    onClick={() => setEditingActivity(activity)}
                                  >
                                    <PencilIcon className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Eliminar ${activity.title}`}
                                    disabled={isSaving}
                                    loading={saving?.kind === 'delete' && saving.activityId === activity.id}
                                    onClick={() => handleActivityDelete(activity)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No hay actividades planificadas para este día</p>
                      <Button
                        variant="outline"
                        className="mt-2"
                        disabled={isSaving}
                        onClick={() => {
                          setSelectedDay(date);
                          setIsAddingActivity(true);
                        }}
                      >
                        <PlusIcon className="h-4 w-4 mr-1" />
                        Agregar primera actividad
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Modal para agregar/editar actividad */}
      {isActivityModalOpen && (
        <ActivityModal
          activity={editingActivity}
          saving={isSaving}
          error={saveError}
          onSave={(draft) => {
            void handleActivitySubmit(draft);
          }}
          onCancel={closeActivityModal}
        />
      )}
    </div>
  );
};

// Modal para agregar/editar actividad
interface ActivityModalProps {
  activity?: PlannerActivity | null;
  onSave: (activity: PlannerActivityDraft) => void;
  onCancel: () => void;
  saving?: boolean;
  error?: string;
}

const ActivityModal: React.FC<ActivityModalProps> = ({
  activity,
  onSave,
  onCancel,
  saving = false,
  error = ''
}) => {
  const [formData, setFormData] = useState({
    title: activity?.title || '',
    description: activity?.description || '',
    startTime: activity?.startTime || '09:00',
    endTime: activity?.endTime || '10:00',
    location: activity?.location || '',
    category: toPlannerCategory(activity?.category || 'activity'),
    cost: activity?.cost?.toString() || '',
    currency: activity?.currency || 'EUR',
    notes: activity?.notes || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) return;

    onSave({
      title: formData.title.trim(),
      description: formData.description.trim(),
      startTime: formData.startTime,
      endTime: formData.endTime,
      location: formData.location.trim(),
      category: formData.category,
      cost: formData.cost ? parseFloat(formData.cost) : undefined,
      currency: formData.currency,
      notes: formData.notes.trim(),
      completed: false
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {activity ? 'Editar Actividad' : 'Nueva Actividad'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título *
              </label>
              <Input
                value={formData.title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Nombre de la actividad"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <textarea
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción opcional"
                className={cn(textareaClassName, 'resize-none')}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora inicio
                </label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora fin
                </label>
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ubicación
              </label>
              <Input
                value={formData.location}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Dirección o lugar"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoría
              </label>
              <select
                value={formData.category}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, category: toPlannerCategory(e.target.value) }))}
                className={selectClassName}
              >
                {ACTIVITY_CATEGORIES.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Costo
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, cost: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Moneda
                </label>
                <select
                  value={formData.currency}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                  className={selectClassName}
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="MXN">MXN</option>
                  <option value="COP">COP</option>
                </select>
              </div>
            </div>

            {error && (
              <div role="alert" className="text-danger text-sm bg-danger/10 p-2 rounded">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
              >
                {activity ? (saving ? 'Actualizando...' : 'Actualizar') : (saving ? 'Agregando...' : 'Agregar')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
