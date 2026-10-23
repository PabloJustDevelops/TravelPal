"use client";

import AccountDataControls from "@/components/settings/AccountDataControls";
import AccountTabs from "@/components/layout/AccountTabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import PageTitle from "@/components/ui/PageTitle";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  ShieldCheckIcon,
  BellIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { getErrorMessage } from "@/lib/utils";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, resetPassword } = useAuth();
  const { showSuccess, showError } = useToast();
  const [sendingReset, setSendingReset] = useState(false);
  const push = usePushNotifications();

  const pushDescription = !push.supported
    ? "Tu navegador no soporta notificaciones push. En iPhone hay que instalar la app en la pantalla de inicio antes de activarlas."
    : push.permission === "denied"
      ? "El navegador ha bloqueado las notificaciones para esta web. Puedes cambiar el permiso en sus ajustes."
      : push.subscribed
        ? "Este navegador está suscrito a los avisos de alertas. Puedes desactivarlos cuando quieras."
        : !push.configured
          ? "Las notificaciones push no están configuradas en este entorno."
          : "Activa los avisos de alertas para este navegador, incluso con la app cerrada.";

  const handleTogglePush = () => {
    if (push.subscribed) {
      void push.unsubscribe();
    } else {
      void push.subscribe();
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) {
      showError("No hay una sesión activa para cambiar la contraseña");
      return;
    }

    setSendingReset(true);
    try {
      await resetPassword(user.email);
      showSuccess(
        `Te hemos enviado un enlace a ${user.email} para cambiar la contraseña`,
      );
    } catch (err: unknown) {
      showError(
        getErrorMessage(err, "No se pudo enviar el correo de recuperación"),
      );
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <DashboardLayout skeleton="settings">
      <div className="mx-auto space-y-8">
        <PageTitle
          title="Ajustes"
          subtitle="Haz que TravelPal encaje contigo."
        />
        <AccountTabs active="settings" />

        <section className="border-b border-line pb-8">
          <h2 className="text-2xl font-bold tracking-tight text-ink">
            Apariencia
          </h2>
          <p className="mt-2 text-muted">Elige cómo quieres ver la app.</p>
          <fieldset className="mt-6">
            <legend className="sr-only">Tema de la aplicación</legend>
            <div className="grid gap-4 sm:grid-cols-3 sm:max-w-3xl">
              {[
                {
                  id: "light",
                  label: "Claro",
                  icon: SunIcon,
                  help: "Papel claro y tinta azul marino.",
                },
                {
                  id: "dark",
                  label: "Oscuro",
                  icon: MoonIcon,
                  help: "Superficies oscuras para menos luz.",
                },
                {
                  id: "system",
                  label: "Automático",
                  icon: ComputerDesktopIcon,
                  help: "Sigue el tema de tu dispositivo.",
                },
              ].map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer flex-col gap-4 rounded-lg border p-5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-accent ${theme === option.id ? "border-accent bg-accent-soft" : "border-line bg-paper"}`}
                >
                  <option.icon
                    className="h-9 w-9 text-accent"
                    aria-hidden="true"
                  />
                  <span className="flex items-center gap-3 font-medium text-ink">
                    <input
                      type="radio"
                      name="theme"
                      value={option.id}
                      checked={theme === option.id}
                      onChange={() =>
                        setTheme(option.id as "light" | "dark" | "system")
                      }
                      className="h-5 w-5 accent-accent"
                    />
                    {option.label}
                  </span>
                  <span className="text-sm leading-relaxed text-muted">
                    {option.help}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>
        {/* Push Notifications */}
        <Card className="rounded-none border-x-0 border-t-0 bg-transparent">
          <CardHeader className="border-0 px-0 pt-0">
            <CardTitle headingLevel={2} className="flex items-center gap-2">
              <BellIcon className="h-6 w-6" />
              Notificaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-0">
            <div className="flex items-center justify-between py-2">
              <div className="pr-4">
                <p className="font-medium text-ink">Avisos de alertas</p>
                <p className="text-sm text-muted">{pushDescription}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={push.subscribed}
                aria-label="Suscripción de notificaciones push"
                disabled={!push.supported || push.busy || (!push.subscribed && (!push.configured || push.permission === "denied"))}
                onClick={handleTogglePush}
                className={`relative inline-flex min-h-11 w-14 items-center flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                  push.subscribed ? "bg-accent" : "bg-line"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-on-accent shadow ring-0 transition duration-200 ease-in-out ${
                    push.subscribed ? "translate-x-5" : "translate-x-0"
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
        <Card className="rounded-none border-x-0 border-t-0 bg-transparent">
          <CardHeader className="border-0 px-0 pt-0">
            <CardTitle headingLevel={2} className="flex items-center gap-2">
              <ShieldCheckIcon className="h-6 w-6" />
              Seguridad
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="space-y-4 px-0">
              <p className="text-sm text-muted">
                Gestiona la seguridad de tu cuenta, contraseña y sesiones
                activas.
              </p>
              <Button
                variant="ghost"
                onClick={handleChangePassword}
                loading={sendingReset}
                className="min-h-11 border border-line px-4 text-sm font-medium text-accent hover:bg-transparent hover:text-accent-hover"
              >
                Cambiar Contraseña
              </Button>
            </div>
          </CardContent>
        </Card>
        <AccountDataControls />
      </div>
    </DashboardLayout>
  );
}
