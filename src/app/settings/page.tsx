"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import PageTitle from "@/components/ui/PageTitle";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Cog6ToothIcon, ShieldCheckIcon, BellIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { getErrorMessage } from "@/lib/utils";

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, resetPassword } = useAuth();
  const { showSuccess, showError } = useToast();
  const [sendingReset, setSendingReset] = useState(false);
  const push = usePushNotifications();

  const isDark = resolvedTheme === 'dark';

  const pushDescription = !push.supported
    ? "Tu navegador no soporta notificaciones push. En iPhone hay que instalar la app en la pantalla de inicio antes de activarlas."
    : push.permission === "denied"
      ? "El navegador ha bloqueado las notificaciones para esta web. Vuelve a permitirlas en los ajustes del navegador para poder activarlas."
      : push.subscribed
        ? "Recibiras un aviso en el navegador cuando una tarea venza, una reserva este por empezar o superes un presupuesto."
        : "Activa los avisos para que te lleguen aunque no tengas la app abierta.";

  const handleTogglePush = () => {
    if (push.subscribed) {
      void push.unsubscribe();
    } else {
      void push.subscribe();
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) {
      showError('No hay una sesión activa para cambiar la contraseña');
      return;
    }

    setSendingReset(true);
    try {
      await resetPassword(user.email);
      showSuccess(`Te hemos enviado un enlace a ${user.email} para cambiar la contraseña`);
    } catch (err: unknown) {
      showError(getErrorMessage(err, 'No se pudo enviar el correo de recuperación'));
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <PageTitle title="Configuración" />

        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cog6ToothIcon className="h-6 w-6" />
              Apariencia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-ink">Modo Oscuro</p>
                <p className="text-sm text-muted">
                  Cambia entre tema claro y oscuro. 
                  {theme === 'system' && <span className="ml-1 text-xs bg-accent-soft text-accent px-2 py-0.5 rounded-full">Automático</span>}
                </p>
              </div>
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
                  isDark ? 'bg-accent' : 'bg-line'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-on-accent shadow ring-0 transition duration-200 ease-in-out ${
                    isDark ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Push Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellIcon className="h-6 w-6" />
              Notificaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="pr-4">
                <p className="font-medium text-ink">Avisos de alertas</p>
                <p className="text-sm text-muted">{pushDescription}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={push.subscribed}
                aria-label="Recibir notificaciones push de las alertas"
                disabled={!push.supported || push.busy || push.permission === "denied"}
                onClick={handleTogglePush}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                  push.subscribed ? 'bg-accent' : 'bg-line'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-on-accent shadow ring-0 transition duration-200 ease-in-out ${
                    push.subscribed ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {push.error && (
              <p role="alert" className="text-sm text-danger">
                {push.error}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="h-6 w-6" />
              Seguridad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Gestiona la seguridad de tu cuenta, contraseña y sesiones activas.
              </p>
              <Button
                variant="ghost"
                onClick={handleChangePassword}
                loading={sendingReset}
                className="px-0 text-sm font-medium text-accent hover:bg-transparent hover:text-accent-hover"
              >
                Cambiar Contraseña
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
