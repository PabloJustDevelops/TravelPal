"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getExistingSubscription,
  getPushPermission,
  getVapidPublicKey,
  isPushSupported,
  type PushPermissionState,
  subscribeToPush,
  syncPushSubscription,
  unsubscribeFromPush,
} from "@/lib/push";
import { getErrorMessage } from "@/lib/utils";

export interface UsePushNotificationsResult {
  supported: boolean;
  configured: boolean;
  permission: PushPermissionState;
  subscribed: boolean;
  busy: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

/**
 * Estado y acciones del alta/baja de notificaciones push en el cliente.
 *
 * Reglas: nunca pide el permiso al montar (solo en `subscribe`, que se invoca
 * desde un gesto del usuario en Ajustes) y la suscripcion viva del navegador es
 * la que manda: al montar se reconcilia con `getSubscription`.
 */
export function usePushNotifications(): UsePushNotificationsResult {
  const { user, loading } = useAuth();
  const userId = user?.id;
  const revision = useRef(0);
  const nextRevision = useCallback(() => ++revision.current, []);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<PushPermissionState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const operation = nextRevision();
    let active = true;
    const current = () => active && revision.current === operation;
    if (!isPushSupported()) {
      setSupported(false);
      setSubscribed(false);
      setBusy(false);
      return;
    }
    setSupported(true);
    setPermission(getPushPermission());
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const existing = await getExistingSubscription();
        if (!current()) return;
        setSubscribed(Boolean(existing));
        if (existing && userId && !loading) await syncPushSubscription();
      } catch (err) {
        if (current()) setError(getErrorMessage(err, "No se pudo sincronizar la suscripción"));
      } finally {
        try {
          const existing = await getExistingSubscription();
          if (current()) setSubscribed(Boolean(existing));
        } catch { /* Conservar el último estado conocido del navegador. */ }
        if (current()) setBusy(false);
      }
    })();
    return () => {
      active = false;
      nextRevision();
    };
  }, [userId, loading, nextRevision]);

  const refreshState = useCallback(async (operation: number) => {
    try {
      const existing = await getExistingSubscription();
      if (revision.current === operation) {
        setSubscribed(Boolean(existing));
        setPermission(getPushPermission());
      }
    } catch { /* Un fallo de lectura no oculta el error de persistencia. */ }
    if (revision.current === operation) setBusy(false);
  }, []);

  const subscribe = useCallback(async () => {
    const operation = nextRevision();
    setBusy(true);
    setError(null);
    try {
      const vapidPublicKey = getVapidPublicKey();
      if (!vapidPublicKey) {
        throw new Error(
          "Las notificaciones push no estan configuradas en este entorno",
        );
      }
      await subscribeToPush(vapidPublicKey);
      if (revision.current === operation) {
        setPermission(getPushPermission());
        setSubscribed(true);
      }
    } catch (err) {
      if (revision.current === operation) {
        setError(
          getErrorMessage(err, "No se pudieron activar las notificaciones"),
        );
      }
    } finally {
      await refreshState(operation);
    }
  }, [refreshState, nextRevision]);

  const unsubscribe = useCallback(async () => {
    const operation = nextRevision();
    setBusy(true);
    setError(null);
    try {
      await unsubscribeFromPush();
      if (revision.current === operation) setSubscribed(false);
    } catch (err) {
      if (revision.current === operation) {
        setError(
          getErrorMessage(err, "No se pudieron desactivar las notificaciones"),
        );
      }
    } finally {
      await refreshState(operation);
    }
  }, [refreshState, nextRevision]);

  return {
    supported,
    configured: Boolean(getVapidPublicKey()),
    permission,
    subscribed,
    busy,
    error,
    subscribe,
    unsubscribe,
  };
}
