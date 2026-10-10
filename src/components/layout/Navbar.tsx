"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";
import {
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import NotificationSystem from "@/components/notifications/NotificationSystem";
interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}
interface NavbarProps {
  navigation: NavigationItem[];
}
export default function Navbar({ navigation }: NavbarProps) {
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const profileToggleRef = useRef<HTMLButtonElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      // Forzamos una recarga completa para limpiar cualquier estado residual
      // y asegurar que el middleware reevalúe la sesión correctamente.
      // Esto soluciona el problema de que a veces se requiere un segundo intento.
      window.location.href = "/signin";
    }
  };
  return (
    <nav aria-label="Navegación principal" onKeyDown={(event) => {
      if (event.key !== "Escape") return;
      if (profileMenuOpen) { setProfileMenuOpen(false); profileToggleRef.current?.focus(); }
      if (mobileMenuOpen) { setMobileMenuOpen(false); mobileToggleRef.current?.focus(); }
    }} className="bg-paper sticky top-0 z-[100] border-b border-line lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:border-b-0 lg:border-r">
      <div className="px-4 sm:px-6 lg:h-full lg:px-4">
        <div className="flex h-16 items-center justify-between gap-4 lg:h-full lg:flex-col lg:items-stretch lg:justify-start lg:py-8">
          <div className="flex-shrink-0 flex items-center">
            <Link
              href="/dashboard"
              className="font-sans text-2xl font-bold tracking-tight text-ink hover:text-accent transition-colors"
            >
              TravelPal
            </Link>
          </div>

          <div className="hidden lg:flex flex-1 items-start pt-8">
            <div className="flex w-full flex-col gap-2">
              {navigation.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`inline-flex min-h-12 items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                      isActive
                        ? "bg-accent-soft text-accent"
                        : "text-muted hover:bg-surface hover:text-ink"
                    }`}
                  >
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 shrink-0 border-t border-line pt-5">
            <NotificationSystem className="shrink-0" panelPlacement="top-start" />
            <div className="relative shrink-0">
              <button
                ref={profileToggleRef}
                id="user-menu-button"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2 rounded-md p-1 pl-2 hover:bg-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Abrir menú de perfil"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
              >
                <span className="text-sm font-medium text-ink max-w-[110px] truncate">
                  {user?.full_name?.split(" ")[0] || "Usuario"}
                </span>
                {user?.avatar_url && !avatarError ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name || "Usuario"}
                    className="h-8 w-8 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <UserCircleIcon className="h-8 w-8 text-muted" />
                )}
              </button>
              {profileMenuOpen && (
                <div
                  className="origin-bottom-left absolute left-0 bottom-full mb-2 w-52 rounded-md border border-line bg-surface shadow-lg z-50 divide-y divide-line overflow-hidden"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="user-menu-button"
                >
                  <div className="px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted mb-1">
                      Conectado como
                    </p>
                    <p className="text-sm font-semibold text-ink truncate">
                      {user?.full_name || "Usuario"}
                    </p>
                    <p className="text-xs text-muted truncate">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/profile"
                      className="flex items-center px-4 py-2.5 text-sm text-ink hover:bg-paper transition-colors"
                      onClick={() => setProfileMenuOpen(false)}
                      role="menuitem"
                    >
                      <UserCircleIcon
                        className="mr-3 h-5 w-5 text-muted"
                        aria-hidden="true"
                      />
                      Mi Perfil
                    </Link>
                    <Link
                      href="/settings"
                      className="flex items-center px-4 py-2.5 text-sm text-ink hover:bg-paper transition-colors"
                      onClick={() => setProfileMenuOpen(false)}
                      role="menuitem"
                    >
                      <Cog6ToothIcon
                        className="mr-3 h-5 w-5 text-muted"
                        aria-hidden="true"
                      />
                      Configuración
                    </Link>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center px-4 py-2.5 text-sm text-danger hover:bg-paper transition-colors"
                      role="menuitem"
                    >
                      <ArrowRightOnRectangleIcon
                        className="mr-3 h-5 w-5"
                        aria-hidden="true"
                      />
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:hidden flex items-center gap-2">
            <NotificationSystem className="shrink-0" />
            <button
              ref={mobileToggleRef}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-md p-2 text-ink hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
              aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? (
                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Bars3Icon className="h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div id="mobile-menu" className="lg:hidden bg-paper border-t border-line">
          <div className="pt-2 pb-3 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                aria-current={pathname === item.href || pathname?.startsWith(item.href + "/") ? "page" : undefined}
                className="flex min-h-12 items-center px-4 py-3 text-base font-medium text-muted hover:text-ink hover:bg-surface aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent"
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon className="h-5 w-5 mr-3" aria-hidden="true" /> {item.name}
              </Link>
            ))}
          </div>
          <div className="pt-4 pb-3 border-t border-line">
            <div className="flex items-center px-4">
              {user?.avatar_url && !avatarError ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name || "Usuario"}
                  className="h-10 w-10 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <UserCircleIcon className="h-10 w-10 text-muted" />
              )}
              <div className="ml-3">
                <div className="text-base font-medium text-ink">
                  {user?.full_name || "Usuario"}
                </div>
                <div className="text-sm text-muted">{user?.email}</div>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <Link
                href="/profile"
                className="block px-4 py-2 text-base font-medium text-muted hover:text-ink hover:bg-surface"
                onClick={() => setMobileMenuOpen(false)}
              >
                Mi Perfil
              </Link>
              <Link
                href="/settings"
                className="block px-4 py-2 text-base font-medium text-muted hover:text-ink hover:bg-surface"
                onClick={() => setMobileMenuOpen(false)}
              >
                Configuración
              </Link>
              <button
                onClick={handleSignOut}
                className="block w-full text-left px-4 py-2 text-base font-medium text-muted hover:text-ink hover:bg-surface"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
