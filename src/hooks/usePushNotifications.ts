"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getExistingSubscription,
  getPushPermission,
  getVapidPublicKey,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  type PushPermissionState,
} from "@/lib/push";
import { getErrorMessage } from "@/lib/utils";

export interface UsePushNotificationsResult {
  supported: boolean;
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
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<PushPermissionState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!isPushSupported()) {
      setSupported(false);
      return;
    }

    setSupported(true);
    setPermission(getPushPermission());

    getExistingSubscription()
      .then((existing) => {
        if (active) setSubscribed(Boolean(existing));
      })
      .catch(() => {
        // Sin suscripcion legible el estado es "desactivado": no es un fallo de UI.
      });

    return () => {
      active = false;
    };
  }, []);

  const subscribe = useCallback(async () => {
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
      setPermission(getPushPermission());
      setSubscribed(true);
    } catch (err) {
      setError(
        getErrorMessage(err, "No se pudieron activar las notificaciones"),
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
    } catch (err) {
      setError(
        getErrorMessage(err, "No se pudieron desactivar las notificaciones"),
      );
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    supported,
    permission,
    subscribed,
    busy,
    error,
    subscribe,
    unsubscribe,
  };
}
