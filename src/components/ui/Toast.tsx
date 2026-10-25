"use client"

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import type { ToastPayload, ToastType } from '@/lib/toast'
import { XMarkIcon } from '@heroicons/react/24/outline'

type ToastItem = Required<ToastPayload> & { id: string }

type ToastContextValue = {
  show: (payload: ToastPayload) => void
  showSuccess: (message: string, title?: string, dismissLabel?: string) => void
  showError: (message: string, title?: string, dismissLabel?: string) => void
  showWarning: (message: string, title?: string, dismissLabel?: string) => void
  showInfo: (message: string, title?: string, dismissLabel?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback((payload: ToastPayload) => {
    const id = Math.random().toString(36).slice(2)
    const duration = payload.durationMs ?? 4000
    const item: ToastItem = {
      id,
      type: payload.type,
      title: payload.title ?? (payload.type === 'error' ? 'Error' : 'Aviso'),
      message: payload.message,
      dismissLabel: payload.dismissLabel ?? 'Cerrar aviso',
      durationMs: duration,
    }
    setToasts((prev) => [...prev, item])
    if (duration > 0) {
      setTimeout(() => remove(id), duration)
    }
  }, [remove])

  const showOfType = useCallback((type: ToastType) => (message: string, title?: string, dismissLabel?: string) => {
    show({ type, message, title, dismissLabel })
  }, [show])

  const value = useMemo<ToastContextValue>(() => ({
    show,
    showSuccess: showOfType('success'),
    showError: showOfType('error'),
    showWarning: showOfType('warning'),
    showInfo: showOfType('info')
  }), [show, showOfType])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ToastPayload>).detail
      if (detail) show(detail)
    }
    window.addEventListener('app:toast', handler as EventListener)
    return () => {
      window.removeEventListener('app:toast', handler as EventListener)
    }
  }, [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}

export function ToastViewport({ toasts, onClose }: { toasts: ToastItem[]; onClose: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col space-y-2 w-80">
      {toasts.map((t) => (
        <div key={t.id} className={toastClass(t.type)}>
          <div className="flex-1">
            {t.title && <div className="font-medium">{t.title}</div>}
            <div className="text-sm">{t.message}</div>
          </div>
          <button
            className="ml-3 text-on-accent/80 hover:text-on-accent"
            onClick={() => onClose(t.id)}
            aria-label={t.dismissLabel}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

function toastClass(type: ToastType) {
  const base = 'flex items-start p-3 rounded-md shadow-lg text-on-accent'
  switch (type) {
    case 'success':
      return `${base} bg-success`
    case 'error':
      return `${base} bg-danger`
    case 'warning':
      return `${base} bg-warning`
    default:
      return `${base} bg-accent`
  }
}