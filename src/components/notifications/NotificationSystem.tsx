"use client";

import React, { useState, useEffect, useCallback, useId } from "react";
import {
  BellIcon,
  XMarkIcon,
  CheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../contexts/AuthContext";
import {
  createInsforgeClient,
  type Booking,
  type Expense,
  type Task,
} from "../../lib/insforge";
import { deriveAlerts, type AlertBudget } from "../../lib/alerts";
import { assertRowsAffected } from "../../lib/insforge-query";
import { formatDate, getErrorMessage } from "../../lib/utils";
import { logger } from "@/lib/logger";
import { showToast } from "@/lib/toast";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "reminder" | "info" | "warning" | "success" | "error";
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  reminderId?: string;
}

// Tipado mínimo para filas de la tabla alerts usadas aquí
interface Alert {
  id: string;
  title: string;
  message: string;
  type: string;
  alert_date?: string;
  created_at: string;
  is_read: boolean;
}

interface NotificationSystemProps {
  className?: string;
}

type InsforgeClient = ReturnType<typeof createInsforgeClient>;

// Lee las alertas NO leidas del usuario (mismo query que usa la campana).
async function loadUnreadAlerts(
  insforge: InsforgeClient,
  userId: string,
  signal?: AbortSignal
): Promise<Alert[]> {
  const query = insforge
    .database.from("alerts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_read", false)
    .order("created_at", { ascending: false });

  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error) throw error;

  return (data || []) as Alert[];
}

/**
 * Da fuente a la campana a partir de datos que ya existen y ya tienen RLS: las
 * alertas derivadas se insertan en `alerts` (el modelo de datos NO cambia) para
 * que "marcar como leida"/descartar sigan funcionando sobre una fila real. Se
 * deduplica por title+message contra TODAS las alertas del usuario (leidas o no),
 * asi que no se reinserta lo que ya tiene. Devuelve true si inserto algo.
 */
async function ensureDerivedAlerts(
  insforge: InsforgeClient,
  userId: string,
  signal?: AbortSignal
): Promise<boolean> {
  // Dedupe: alertas ya presentes del usuario, leidas o no.
  const existingQuery = insforge
    .database.from("alerts")
    .select("title, message")
    .eq("user_id", userId);

  const { data: existingData, error: existingError } = await (signal
    ? existingQuery.abortSignal(signal)
    : existingQuery);
  if (existingError) throw existingError;

  const existingKeys = new Set(
    ((existingData || []) as { title: string; message: string }[]).map(
      (alert) => `${alert.title}\u0000${alert.message}`
    )
  );

  const [tasksRes, bookingsRes, budgetsRes, expensesRes] = await Promise.all([
    insforge.database.from("tasks").select("*").eq("user_id", userId),
    insforge.database.from("bookings").select("*").eq("user_id", userId),
    insforge.database.from("budgets").select("*").eq("user_id", userId),
    insforge.database.from("expenses").select("*").eq("user_id", userId),
  ]);

  if (tasksRes.error) throw tasksRes.error;
  if (bookingsRes.error) throw bookingsRes.error;
  if (budgetsRes.error) throw budgetsRes.error;
  if (expensesRes.error) throw expensesRes.error;

  const derived = deriveAlerts({
    tasks: (tasksRes.data || []) as Task[],
    bookings: (bookingsRes.data || []) as Booking[],
    budgets: (budgetsRes.data || []) as AlertBudget[],
    expenses: (expensesRes.data || []) as Expense[],
  });

  const toInsert = derived
    .filter((alert) => !existingKeys.has(`${alert.title}\u0000${alert.message}`))
    .map((alert) => ({
      user_id: userId,
      title: alert.title,
      message: alert.message,
      type: alert.type,
      alert_date: alert.alert_date,
      is_read: false,
    }));

  if (toInsert.length === 0) return false;

  const { error: insertError } = await insforge
    .database.from("alerts")
    .insert(toInsert);
  if (insertError) throw insertError;

  return true;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({
  className = "",
}) => {
  const { user } = useAuth();
  // La campana se monta a la vez en la barra de escritorio y en la de movil (una de las dos
  // oculta por CSS), asi que los identificadores del panel tienen que ser unicos por instancia.
  const panelId = useId();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Cargar alertas pendientes (type: 'reminder' | 'warning' | 'info')
  const loadPendingAlerts = useCallback(
    async (signal?: AbortSignal) => {
      if (!user) return;

      try {
        setIsLoading(true);
        const insforge = createInsforgeClient();

        const rows = await loadUnreadAlerts(insforge, user.id, signal);

        // Enriquecimiento best-effort: da fuente a la campana insertando las
        // alertas derivadas que falten. Un fallo aqui NO debe romper la campana:
        // se registra y se sigue mostrando lo que ya hubiera.
        let inserted = false;
        try {
          inserted = await ensureDerivedAlerts(insforge, user.id, signal);
        } catch (enrichErr: unknown) {
          logger.error("NotificationSystem: Error deriving alerts", {
            error: getErrorMessage(enrichErr),
          });
        }

        if (signal?.aborted) return;

        // Si se insertaron alertas nuevas, recarga para mostrarlas.
        const finalRows = inserted
          ? await loadUnreadAlerts(insforge, user.id, signal)
          : rows;

        const pendingAlerts = finalRows.filter((a) =>
          ["reminder", "warning", "info"].includes(a.type)
        );

        const alertNotifications: Notification[] = pendingAlerts.map(
          (alert: Alert) => ({
            id: `alert_${alert.id}`,
            title: alert.title,
            message: alert.message,
            type: (alert.type as Notification["type"]) ?? "info",
            timestamp: alert.alert_date ?? alert.created_at,
            read: alert.is_read,
            actionLabel: "Marcar como leído",
          })
        );

        setNotifications((prev) => {
          const existingIds = prev.map((n) => n.id);
          const newNotifications = alertNotifications.filter(
            (n) => !existingIds.includes(n.id)
          );
          return [...prev, ...newNotifications];
        });
      } catch (err: unknown) {
        if (
          (err instanceof Error && err.name === "AbortError") ||
          (typeof err === "object" && err !== null && "code" in err && (err as any).code === 20) ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          return;
        }
        
        const errObj = err as any;
        if (errObj?.message?.includes("AbortError") || errObj?.details?.includes("AbortError")) {
            return;
        }

        const message = getErrorMessage(err);
        logger.error("NotificationSystem: Error loading alerts", { error: message });
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  // Cargar notificaciones al montar el componente con cancelación
  useEffect(() => {
    const controller = new AbortController();

    loadPendingAlerts(controller.signal);

    // Configurar intervalo para verificar nuevas alertas cada 5 minutos
    const interval = setInterval(
      () => loadPendingAlerts(controller.signal),
      5 * 60 * 1000
    );

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [loadPendingAlerts]);

  // Actualizar contador de no leídas
  useEffect(() => {
    const unread = notifications.filter((n) => !n.read).length;
    setUnreadCount(unread);
  }, [notifications]);

  // Solicitar permisos de notificación del navegador
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Marcar notificación como leída (actualiza alert.is_read)
  const markAsRead = async (notificationId: string) => {
    const notification = notifications.find((n) => n.id === notificationId);
    if (!notification) return;

    try {
      const insforge = createInsforgeClient();
      const alertId = notificationId.replace("alert_", "");
      const { data: updatedRows, error } = await insforge
        .database.from("alerts")
        .update({ is_read: true })
        .eq("id", alertId)
        .select();

      if (error) throw error;
      assertRowsAffected(updatedRows, "No se pudo marcar la alerta como leída");
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      logger.error("NotificationSystem: Error marking alert as read", { error: message });
      showToast({ type: "error", title: "Error al marcar como leída", message });
      return;
    }

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  // Descartar notificación (marcar como leída)
  const dismissNotification = async (notificationId: string) => {
    try {
      const insforge = createInsforgeClient();
      const alertId = notificationId.replace("alert_", "");
      const { data: updatedRows, error } = await insforge
        .database.from("alerts")
        .update({ is_read: true })
        .eq("id", alertId)
        .select();

      if (error) throw error;
      assertRowsAffected(updatedRows, "No se pudo descartar la alerta");
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      logger.error("NotificationSystem: Error dismissing alert", { error: message });
      showToast({ type: "error", title: "Error al descartar", message });
      return;
    }

    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  // Marcar todas como leídas
  const markAllAsRead = async () => {
    try {
      const insforge = createInsforgeClient();
      const { data: updatedRows, error } = await insforge
        .database.from("alerts")
        .update({ is_read: true })
        .eq("user_id", user!.id)
        .eq("is_read", false)
        .select();

      if (error) throw error;
      assertRowsAffected(updatedRows, "No se pudieron marcar como leídas");
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      logger.error("NotificationSystem: Error marking all alerts as read", { error: message });
      showToast({ type: "error", title: "Error al marcar todas", message });
      return;
    }

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // Limpiar todas las notificaciones locales
  const clearAll = () => {
    setNotifications([]);
  };

  // Obtener icono según el tipo
  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "reminder":
        return <ClockIcon className="h-5 w-5 text-accent" />;
      case "warning":
        return <ExclamationTriangleIcon className="h-5 w-5 text-warning" />;
      case "error":
        return <XMarkIcon className="h-5 w-5 text-danger" />;
      case "success":
        return <CheckIcon className="h-5 w-5 text-success" />;
      default:
        return <InformationCircleIcon className="h-5 w-5 text-muted" />;
    }
  };

  // Obtener color de fondo según el tipo
  const getNotificationBg = (type: Notification["type"], read: boolean) => {
    const opacity = read ? "bg-opacity-50" : "bg-opacity-100";
    switch (type) {
      case "reminder":
        return `bg-accent-soft ${opacity}`;
      case "warning":
        return `bg-warning/10 ${opacity}`;
      case "error":
        return `bg-danger/10 ${opacity}`;
      case "success":
        return `bg-success/10 ${opacity}`;
      default:
        return `bg-surface-strong ${opacity}`;
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Botón de notificaciones */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 rounded-lg"
        aria-label={
          unreadCount > 0
            ? `Notificaciones, ${unreadCount} sin leer`
            : "Notificaciones"
        }
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <BellIcon className="h-6 w-6" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 bg-danger text-on-accent text-xs rounded-full h-5 w-5 flex items-center justify-center"
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel de notificaciones: se ancla a la campana. En movil la campana comparte fila con
          el boton de menu (2.5rem) y con el padding del contenedor (1rem), asi que el panel nunca
          debe medir mas que la pantalla menos ese hueco; en escritorio el tope no se aplica. */}
      {isOpen && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={`${panelId}-titulo`}
          className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-5rem)] bg-surface rounded-lg shadow-lg border border-line z-50 max-h-96 overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <h3
              id={`${panelId}-titulo`}
              className="text-lg font-semibold text-ink"
            >
              Notificaciones
            </h3>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-accent hover:text-accent-hover"
                >
                  Marcar todas
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted hover:text-ink"
                aria-label="Cerrar notificaciones"
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Lista de notificaciones */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center">
                <LoadingSpinner size="sm" />
                <p className="text-sm text-muted mt-2">
                  Cargando notificaciones...
                </p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <BellIcon className="h-12 w-12 text-muted mx-auto mb-4" />
                <p className="text-muted">No hay notificaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-surface-strong transition-colors ${getNotificationBg(
                      notification.type,
                      notification.read
                    )}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p
                              className={`text-sm font-medium ${
                                notification.read
                                  ? "text-muted"
                                  : "text-ink"
                              }`}
                            >
                              {notification.title}
                            </p>
                            <p
                              className={`text-sm mt-1 ${
                                notification.read
                                  ? "text-muted"
                                  : "text-muted"
                              }`}
                            >
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted mt-2">
                              {formatDate(new Date(notification.timestamp))} a
                              las{" "}
                              {new Date(
                                notification.timestamp
                              ).toLocaleTimeString()}
                            </p>
                          </div>

                          <div className="flex items-center space-x-1 ml-2">
                            {!notification.read && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="text-accent hover:text-accent-hover text-xs"
                                title="Marcar como leída"
                                aria-label={`Marcar como leída: ${notification.title}`}
                              >
                                <CheckIcon className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                            <button
                              onClick={() =>
                                dismissNotification(notification.id)
                              }
                              className="text-muted hover:text-ink text-xs"
                              title="Descartar"
                              aria-label={`Descartar: ${notification.title}`}
                            >
                              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        {notification.actionLabel && notification.actionUrl && (
                          <div className="mt-3">
                            <a
                              href={notification.actionUrl}
                              className="text-sm text-accent hover:text-accent-hover font-medium"
                            >
                              {notification.actionLabel}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-line bg-surface-strong">
              <button
                onClick={clearAll}
                className="text-sm text-muted hover:text-ink w-full text-center"
              >
                Limpiar todas las notificaciones
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Hook para usar el sistema de notificaciones
export const useNotifications = () => {
  const [notificationSystem, setNotificationSystem] = useState<{
    addNotification: (
      notification: Omit<Notification, "id" | "timestamp" | "read">
    ) => string;
    markAsRead: (id: string) => void;
    dismissNotification: (id: string) => void;
  } | null>(null);

  const addNotification = useCallback(
    (notification: Omit<Notification, "id" | "timestamp" | "read">) => {
      if (notificationSystem) {
        return notificationSystem.addNotification(notification);
      }
      return "";
    },
    [notificationSystem]
  );

  const showSuccess = useCallback(
    (title: string, message: string) => {
      return addNotification({ title, message, type: "success" });
    },
    [addNotification]
  );

  const showError = useCallback(
    (title: string, message: string) => {
      return addNotification({ title, message, type: "error" });
    },
    [addNotification]
  );

  const showWarning = useCallback(
    (title: string, message: string) => {
      return addNotification({ title, message, type: "warning" });
    },
    [addNotification]
  );

  const showInfo = useCallback(
    (title: string, message: string) => {
      return addNotification({ title, message, type: "info" });
    },
    [addNotification]
  );

  const showReminder = useCallback(
    (
      title: string,
      message: string,
      actionUrl?: string,
      actionLabel?: string
    ) => {
      return addNotification({
        title,
        message,
        type: "reminder",
        actionUrl,
        actionLabel,
      });
    },
    [addNotification]
  );

  return {
    addNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showReminder,
    setNotificationSystem,
  };
};

export default NotificationSystem;
