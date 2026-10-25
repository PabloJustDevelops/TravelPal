'use client';

import React, { useId, useRef, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
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
  cn,
  getErrorMessage,
  formatCurrency,
} from '../../lib/utils';
import { queryErrorKind } from '../../lib/insforge-query';
import { logger } from '@/lib/logger';
import { useI18n } from '@/lib/i18n/LocaleProvider';
import { formatNumber } from '@/lib/i18n';

const ACTIVITY_CATEGORIES = [
  { value: 'transport', key: 'transportation', label: 'Transporte', color: 'bg-surface text-muted' },
  { value: 'accommodation', key: 'accommodation', label: 'Alojamiento', color: 'bg-surface text-muted' },
  { value: 'food', key: 'food', label: 'Comida', color: 'bg-surface text-muted' },
  { value: 'activity', key: 'activity', label: 'Actividad', color: 'bg-surface text-muted' },
  { value: 'shopping', key: 'shopping', label: 'Compras', color: 'bg-surface text-muted' },
  { value: 'other', key: 'other', label: 'Otro', color: 'bg-surface text-muted' }
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
  onMoveActivity?: (activityId: string, direction: -1 | 1) => Promise<void>;
  className?: string;
  headingLevel?: 2 | 3;
  showHeading?: boolean;
  activeDate?: string;
  onSelectDay?: (date: string) => void;
}

interface SaveOperation {
  kind: 'create' | 'update' | 'delete' | 'move';
  activityId: string;
}

export const ItineraryPlanner: React.FC<ItineraryPlannerProps> = ({
  startDate,
  endDate,
  itinerary = [],
  onCreateActivity,
  onUpdateActivity,
  onDeleteActivity,
  onMoveActivity,
  className = '',
  headingLevel = 2,
  showHeading = true,
  activeDate,
  onSelectDay,
}) => {
  const { locale, t } = useI18n();
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
          ? t("connectionTimeout")
          : getErrorMessage(err, t("activityOperationError"));
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

  // Los costos se agrupan por moneda; no hay una conversión definida para sumarlos.
  const getDayCostsByCurrency = (activities: PlannerActivity[]) => {
    const totals = new Map<string, number>();
    for (const activity of activities) {
      if (typeof activity.cost !== 'number' || !Number.isFinite(activity.cost)) continue;
      const currency = activity.currency || 'EUR';
      totals.set(currency, (totals.get(currency) ?? 0) + activity.cost);
    }
    return [...totals.entries()];
  };

  const isSaving = saving !== null;
  const isActivityModalOpen = isAddingActivity || editingActivity !== null;
  const PlannerHeading = headingLevel === 3 ? 'h3' : 'h2';

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      {showHeading && <div>
        <PlannerHeading className="text-xl font-semibold text-ink">{t("plannerTitle")}</PlannerHeading>
        <p className="text-muted">
          {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", { year: "numeric", month: "long", day: "numeric" }).format(new Date(startDate))} - {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", { year: "numeric", month: "long", day: "numeric" }).format(new Date(endDate))}
        </p>
      </div>

      }
      {saveError && !isActivityModalOpen && (
        <div role="alert" className="text-danger text-sm bg-danger/10 p-2 rounded">
          {saveError}
        </div>
      )}

      <div role="group" aria-label={t("tripDays")} className="grid grid-cols-3 gap-2 border-b border-line pb-5 sm:grid-cols-6">
        {tripDays.map((date, index) => <Button key={date} variant="outline" aria-pressed={activeDate ? date === (tripDays.includes(activeDate) ? activeDate : tripDays[0]) : expandedDays.has(date)} onClick={() => { setExpandedDays(new Set([date])); onSelectDay?.(date); }} aria-label={t("viewDay").replace("{day}", formatNumber(index + 1, locale)).replace("{date}", new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", { year: "numeric", month: "long", day: "numeric" }).format(parseISO(date)))} className={`min-h-14 px-2 text-sm transition-none ${expandedDays.has(date) || date === activeDate ? "border-accent bg-accent-soft text-accent" : ""}`}><span>{parseISO(date).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES',{weekday:'short',day:'numeric',month:'short'})}</span></Button>)}
      </div>
      {/* Días del viaje */}
      <div className="space-y-4">
        {tripDays.map((date, index) => {
          if (activeDate && date !== (tripDays.includes(activeDate) ? activeDate : tripDays[0])) return null;
          const dayItinerary = getDayItinerary(date);
          const isExpanded = !!activeDate || expandedDays.has(date);
          const dayDate = parseISO(date);
          const dayName = dayDate.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', { weekday: 'long' });
          const dayCosts = getDayCostsByCurrency(dayItinerary.activities);

          return (
            <Card key={date} className="overflow-hidden rounded-none border-x-0 border-t-0 bg-transparent">
              {/* Header del día */}
              <div className="flex items-center justify-between gap-3 border-b border-line bg-transparent px-0 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="min-w-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={`itinerary-day-${date}`}
                      onClick={() => toggleDayExpanded(date)}
                      className="h-auto min-h-11 items-center gap-2 px-0 py-0 text-left"
                    >
                      {isExpanded ? (
                        <ChevronUpIcon className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                      ) : (
                        <ChevronDownIcon className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                      )}
                      <span>
                        <span className="block font-semibold text-ink">
                          {t("day").replace("{day}", formatNumber(index + 1, locale))} - {dayName}
                        </span>
                        <span className="block text-sm font-normal text-muted">
                          {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", { year: "numeric", month: "long", day: "numeric" }).format(dayDate)}
                        </span>
                      </span>
                    </Button>
                  </h3>

                </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="hidden text-right sm:block">
                      <p className="text-sm text-muted">
                        {dayItinerary.activities.length} {dayItinerary.activities.length === 1 ? t('activityOne') : t('activityMany')}
                      </p>
                      {dayCosts.length > 0 && (
                        <ul aria-label={t("activityCosts")} className="text-sm font-medium text-ink">
                          {dayCosts.map(([currency, total]) => (
                            <li key={currency}>{formatCurrency(total, currency, locale)}</li>
                          ))}
                        </ul>
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
                      {t("add")}
                    </Button>
                  </div>
              </div>

              {/* Contenido del día */}
              {isExpanded && (
                <div id={`itinerary-day-${date}`} className="space-y-4 py-4">
                  {/* Actividades */}
                  {dayItinerary.activities.length > 0 ? (
                    <div className="space-y-3">
                      {dayItinerary.activities.map((activity, activityIndex) => {
                        const category = getActivityCategory(activity.category);

                        return (
                          <div
                            key={activity.id}
                            className="flex items-start space-x-3 border-b border-line bg-transparent py-5"
                          >
                            <div className="flex-shrink-0">
                              <CategoryIcon
                                category={category.value}
                                className="h-5 w-5 text-muted"
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                  <h4 className="break-words font-medium text-ink">
                                    {activity.title}
                                  </h4>
                                  {activity.description && (
                                    <p className="mt-1 text-sm text-muted">
                                      {activity.description}
                                    </p>
                                  )}

                                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                                    <div className="flex min-w-0 flex-wrap items-center gap-x-1">
                                      <ClockIcon className="h-4 w-4" />
                                      <span>{activity.startTime.slice(0, 5)} - {activity.endTime.slice(0, 5)}</span>
                                    </div>
                                    {activity.location && (
                                      <div className="flex min-w-0 flex-wrap items-center gap-x-1 break-words">
                                        <MapPinIcon className="h-4 w-4" />
                                        <span>{activity.location}</span>
                                      </div>
                                    )}
                                    {typeof activity.cost === 'number' && (
                                      <span className="font-medium text-ink">
                                        {formatCurrency(activity.cost, activity.currency || 'EUR', locale)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex min-w-0 flex-wrap items-center gap-2 sm:ml-4 sm:shrink-0 sm:flex-nowrap">
                                  <span className={`max-w-full break-words rounded-full px-2 py-1 text-xs font-medium ${category.color}`}>
                                    {t(category.key)}
                                  </span>
                                  {onMoveActivity && <div className="flex items-center">
                                    <Button variant="ghost" aria-label={t("moveUp").replace("{title}", activity.title)} disabled={isSaving || activityIndex === 0} className="min-h-11 min-w-11 px-2" onClick={() => void runOperation({kind:'move',activityId:activity.id}, () => onMoveActivity(activity.id,-1))}><ChevronUpIcon className="h-4 w-4" aria-hidden="true" /></Button>
                                    <Button variant="ghost" aria-label={t("moveDown").replace("{title}", activity.title)} disabled={isSaving || activityIndex === dayItinerary.activities.length-1} className="min-h-11 min-w-11 px-2" onClick={() => void runOperation({kind:'move',activityId:activity.id}, () => onMoveActivity(activity.id,1))}><ChevronDownIcon className="h-4 w-4" aria-hidden="true" /></Button>
                                  </div>}
                                  <Button
                                    variant="ghost"
                                    size="md"
                                    aria-label={t("editActivityAction") + " " + activity.title}
                                    disabled={isSaving}
                                    onClick={() => setEditingActivity(activity)}
                                    className="min-h-11 min-w-11 shrink-0 p-0"
                                  >
                                    <PencilIcon className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="md"
                                    aria-label={t("removeActivity").replace("{title}", activity.title)}
                                    disabled={isSaving}
                                    loading={saving?.kind === 'delete' && saving.activityId === activity.id}
                                    onClick={() => handleActivityDelete(activity)}
                                    className="min-h-11 min-w-11 shrink-0 p-0 text-red-600 hover:text-red-700"
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
                    <div className="py-8 text-center text-muted">
                      <p>{t("noPlannedActivities")}</p>
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
                        {t("addFirstActivity")}
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
  const id = useId();
  const { t } = useI18n();
  const titleInputRef = useRef<HTMLInputElement>(null);
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
    <Dialog open onClose={onCancel} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <DialogPanel className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-paper p-6 text-ink shadow-xl">
          <DialogTitle as="h2" className="mb-4 font-sans text-xl font-semibold text-ink">
            {activity ? t('editActivity') : t('newActivity')}
          </DialogTitle>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor={`${id}-title`} className="mb-1 block text-sm font-medium text-ink">
                {t("activityTitle")}
              </label>
              <Input
                id={`${id}-title`}
                ref={titleInputRef}
                autoFocus
                value={formData.title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder={t("activityName")}
                required
              />
            </div>

            <div>
              <label htmlFor={`${id}-description`} className="mb-1 block text-sm font-medium text-ink">
                {t("activityDescription")}
              </label>
              <textarea
                id={`${id}-description`}
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t("optionalDescription")}
                className={cn(textareaClassName, 'resize-none')}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor={`${id}-start-time`} className="mb-1 block text-sm font-medium text-ink">
                  {t("startTime")}
                </label>
                <Input
                  id={`${id}-start-time`}
                  type="time"
                  value={formData.startTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor={`${id}-end-time`} className="mb-1 block text-sm font-medium text-ink">
                  {t("endTime")}
                </label>
                <Input
                  id={`${id}-end-time`}
                  type="time"
                  value={formData.endTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label htmlFor={`${id}-location`} className="mb-1 block text-sm font-medium text-ink">
                {t("location")}
              </label>
              <Input
                id={`${id}-location`}
                value={formData.location}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder={t("addressOrPlace")}
              />
            </div>

            <div>
              <label htmlFor={`${id}-category`} className="mb-1 block text-sm font-medium text-ink">
                {t("category")}
              </label>
              <select
                id={`${id}-category`}
                value={formData.category}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, category: toPlannerCategory(e.target.value) }))}
                className={selectClassName}
              >
                {ACTIVITY_CATEGORIES.map(category => (
                  <option key={category.value} value={category.value}>
                    {t(category.key)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor={`${id}-cost`} className="mb-1 block text-sm font-medium text-ink">
                  {t("cost")}
                </label>
                <Input
                  id={`${id}-cost`}
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, cost: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label htmlFor={`${id}-currency`} className="mb-1 block text-sm font-medium text-ink">
                  {t("currency")}
                </label>
                <select
                  id={`${id}-currency`}
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
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={saving}
              >
                {activity ? (saving ? t('updating') : t('update')) : (saving ? t('adding') : t('add'))}
              </Button>
            </div>
          </form>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
};
