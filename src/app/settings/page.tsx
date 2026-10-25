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
import { useI18n } from '@/lib/i18n/LocaleProvider';

export function SettingsPageContent({t, locale}: Pick<ReturnType<typeof useI18n>, 't' | 'locale'>) {
  const { theme, setTheme } = useTheme();
  const { user, resetPassword } = useAuth();
  const { showSuccess, showError } = useToast();
  const [sendingReset, setSendingReset] = useState(false);
  const push = usePushNotifications();

  const pushDescription = !push.supported
    ? t('pushUnsupported')
    : push.permission === "denied"
      ? t('pushDenied')
      : push.subscribed
        ? t('pushSubscribed')
        : !push.configured
          ? t('pushNotConfigured')
          : t('pushEnable');

  const handleTogglePush = () => {
    if (push.subscribed) {
      void push.unsubscribe();
    } else {
      void push.subscribe();
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) {
      showError(t('passwordResetNoSession'), t('errorToastTitle'), t('toastDismiss'));
      return;
    }

    setSendingReset(true);
    try {
      await resetPassword(user.email, locale);
      showSuccess(
        t('passwordResetSent').replace('{email}', user.email), t('noticeTitle'), t('toastDismiss'),
      );
    } catch {
      showError(
        t('passwordResetError'), t('errorToastTitle'), t('toastDismiss'),
      );
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <DashboardLayout skeleton="settings">
      <div className="mx-auto space-y-8">
        <PageTitle
          title={t('settingsTitle')}
          subtitle={t('settingsSubtitle')}
        />
        <AccountTabs active="settings" />

        <section className="border-b border-line pb-8">
          <h2 className="text-2xl font-bold tracking-tight text-ink">
            {t('appearance')}
          </h2>
          <p className="mt-2 text-muted">{t('appearanceDescription')}</p>
          <fieldset className="mt-6">
            <legend className="sr-only">{t('appTheme')}</legend>
            <div className="grid gap-4 sm:grid-cols-3 sm:max-w-3xl">
              {[
                {
                  id: "light",
                  label: t('themeLight'),
                  icon: SunIcon,
                  help: t('themeLightHelp'),
                },
                {
                  id: "dark",
                  label: t('themeDark'),
                  icon: MoonIcon,
                  help: t('themeDarkHelp'),
                },
                {
                  id: "system",
                  label: t('themeSystem'),
                  icon: ComputerDesktopIcon,
                  help: t('themeSystemHelp'),
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
              {t('notificationsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-0">
            <div className="flex items-center justify-between py-2">
              <div className="pr-4">
                <p className="font-medium text-ink">{t('pushAlerts')}</p>
                <p className="text-sm text-muted">{pushDescription}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={push.subscribed}
                aria-label={t('pushSubscription')}
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
                {t("pushRequestError")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="rounded-none border-x-0 border-t-0 bg-transparent">
          <CardHeader className="border-0 px-0 pt-0">
            <CardTitle headingLevel={2} className="flex items-center gap-2">
              <ShieldCheckIcon className="h-6 w-6" />
              {t('security')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="space-y-4 px-0">
              <p className="text-sm text-muted">
                {t('securityDescription')}
              </p>
              <Button
                variant="ghost"
                onClick={handleChangePassword}
                loading={sendingReset}
                className="min-h-11 border border-line px-4 text-sm font-medium text-accent hover:bg-transparent hover:text-accent-hover"
              >
                {t('changePassword')}
              </Button>
            </div>
          </CardContent>
        </Card>
        <AccountDataControls />
      </div>
    </DashboardLayout>
  );
}

export default function SettingsPage() {
  const i18n = useI18n()
  return <SettingsPageContent {...i18n} />
}
