'use client';

import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  ClockIcon, 
  MapPinIcon, 
  TrashIcon,
  PencilIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { textareaClassName, selectClassName } from '../ui/fieldStyles';
import CategoryIcon from '../ui/CategoryIcon';
import { Card } from '../ui/Card';
import { format, parseISO } from 'date-fns';
import { formatDate, cn } from '../../lib/utils';

interface Activity {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  category: 'transport' | 'accommodation' | 'food' | 'activity' | 'shopping' | 'other';
  cost?: number;
  currency?: string;
  notes?: string;
  completed?: boolean;
}

interface DayItinerary {
  date: string;
  activities: Activity[];
  notes?: string;
}

interface ItineraryPlannerProps {
  tripId: string;
  startDate: string;
  endDate: string;
  itinerary?: DayItinerary[];
  onSave?: (itinerary: DayItinerary[]) => void;
  className?: string;
}

const ACTIVITY_CATEGORIES = [
  { value: 'transport', label: 'Transporte', color: 'bg-blue-100 text-blue-800' },
  { value: 'accommodation', label: 'Alojamiento', color: 'bg-purple-100 text-purple-800' },
  { value: 'food', label: 'Comida', color: 'bg-orange-100 text-orange-800' },
  { value: 'activity', label: 'Actividad', color: 'bg-green-100 text-green-800' },
  { value: 'shopping', label: 'Compras', color: 'bg-pink-100 text-pink-800' },
  { value: 'other', label: 'Otro', color: 'bg-gray-100 text-gray-800' }
];

export const ItineraryPlanner: React.FC<ItineraryPlannerProps> = ({
  startDate,
  endDate,
  itinerary = [],
  onSave,
  className = ''
}) => {
  const [currentItinerary, setCurrentItinerary] = useState<DayItinerary[]>(itinerary);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Generar días del viaje
  const generateTripDays = () => {
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

  // Inicializar itinerario si está vacío
  useEffect(() => {
    if (tripDays.length > 0 && currentItinerary.length === 0) {
      const initialItinerary = tripDays.map(date => ({
        date,
        activities: [],
        notes: ''
      }));
      setCurrentItinerary(initialItinerary);
    }
  }, [tripDays, currentItinerary.length]);

  // Obtener itinerario de un día específico
  const getDayItinerary = (date: string): DayItinerary => {
    return currentItinerary.find(day => day.date === date) || {
      date,
      activities: [],
      notes: ''
    };
  };

  // Agregar nueva actividad
  const addActivity = (date: string, activity: Omit<Activity, 'id'>) => {
    const newActivity: Activity = {
      ...activity,
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    setCurrentItinerary(prev => {
      const updated = prev.map(day => {
        if (day.date === date) {
          return {
            ...day,
            activities: [...day.activities, newActivity].sort((a, b) => 
              a.startTime.localeCompare(b.startTime)
            )
          };
        }
        return day;
      });
      
      // Si el día no existe, crearlo
      if (!updated.find(day => day.date === date)) {
        updated.push({
          date,
          activities: [newActivity],
          notes: ''
        });
      }
      
      return updated;
    });

    setIsAddingActivity(false);
    setSelectedDay('');
  };

  // Editar actividad
  const updateActivity = (date: string, activityId: string, updates: Partial<Activity>) => {
    setCurrentItinerary(prev =>
      prev.map(day => {
        if (day.date === date) {
          return {
            ...day,
            activities: day.activities.map(activity =>
              activity.id === activityId ? { ...activity, ...updates } : activity
            ).sort((a, b) => a.startTime.localeCompare(b.startTime))
          };
        }
        return day;
      })
    );
  };

  // Eliminar actividad
  const deleteActivity = (date: string, activityId: string) => {
    setCurrentItinerary(prev =>
      prev.map(day => {
        if (day.date === date) {
          return {
            ...day,
            activities: day.activities.filter(activity => activity.id !== activityId)
          };
        }
        return day;
      })
    );
  };

  // Actualizar notas del día
  const updateDayNotes = (date: string, notes: string) => {
    setCurrentItinerary(prev =>
      prev.map(day => {
        if (day.date === date) {
          return { ...day, notes };
        }
        return day;
      })
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
  const getActivityCategory = (category: string) => {
    return ACTIVITY_CATEGORIES.find(cat => cat.value === category) || ACTIVITY_CATEGORIES[5];
  };

  // Calcular costo total del día
  const getDayTotalCost = (activities: Activity[]) => {
    return activities.reduce((total, activity) => total + (activity.cost || 0), 0);
  };

  // Guardar itinerario
  const handleSave = () => {
    onSave?.(currentItinerary);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Planificador de Itinerario</h2>
          <p className="text-gray-600">
            {formatDate(new Date(startDate))} - {formatDate(new Date(endDate))}
          </p>
        </div>
        <Button onClick={handleSave}>
          Guardar Itinerario
        </Button>
      </div>

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
                                    onClick={() => setEditingActivity(activity)}
                                  >
                                    <PencilIcon className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteActivity(date, activity.id)}
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

                  {/* Notas del día */}
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notas del día
                    </label>
                    <textarea
                      value={dayItinerary.notes || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateDayNotes(date, e.target.value)}
                      placeholder="Agregar notas, recordatorios o información adicional..."
                      className={cn(textareaClassName, 'resize-none')}
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Modal para agregar/editar actividad */}
      {(isAddingActivity || editingActivity) && (
        <ActivityModal
          activity={editingActivity}
          onSave={(activity) => {
            if (editingActivity) {
              updateActivity(selectedDay, editingActivity.id, activity);
              setEditingActivity(null);
            } else {
              addActivity(selectedDay, activity);
            }
          }}
          onCancel={() => {
            setIsAddingActivity(false);
            setEditingActivity(null);
            setSelectedDay('');
          }}
        />
      )}
    </div>
  );
};

// Modal para agregar/editar actividad
interface ActivityModalProps {
  activity?: Activity | null;
  onSave: (activity: Omit<Activity, 'id'>) => void;
  onCancel: () => void;
}

const ActivityModal: React.FC<ActivityModalProps> = ({
  activity,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    title: activity?.title || '',
    description: activity?.description || '',
    startTime: activity?.startTime || '09:00',
    endTime: activity?.endTime || '10:00',
    location: activity?.location || '',
    category: activity?.category || 'activity',
    cost: activity?.cost?.toString() || '',
    currency: activity?.currency || 'USD',
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
      category: formData.category as Activity['category'],
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
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, category: e.target.value as Activity['category'] }))}
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
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="MXN">MXN</option>
                  <option value="COP">COP</option>
                </select>
              </div>
            </div>

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
              >
                {activity ? 'Actualizar' : 'Agregar'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};