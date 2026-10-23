"use client";

import { usePushNotifications } from "@/hooks/usePushNotifications";

/** Reconcilia al hidratar la sesión y al cambiar de cuenta en cualquier pantalla. */
export default function PushSubscriptionSync() {
  usePushNotifications();
  return null;
}
