import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePassword(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra mayúscula')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra minúscula')
  }
  
  if (!/\d/.test(password)) {
    errors.push('La contraseña debe contener al menos un número')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

export function getLoadErrorMessage(
  error: { kind: "timeout" | "request" } | null,
  messages: { timeout: string; request: string },
): string | null {
  if (!error) return null;
  return error.kind === "timeout" ? messages.timeout : messages.request;
}

// Texto de las escrituras que se quedan esperando: el SDK no tiene techo
// propio, asi que un guardado colgado cae aqui en vez de en su error generico.
export const CONNECTION_TIMEOUT_MESSAGE =
  "La conexión ha tardado demasiado. Por favor verifica tu conexión a internet e inténtalo de nuevo.";

export function getErrorMessage(err: unknown, fallbackMessage?: string): string {
  let baseMessage: string
  if (err instanceof Error) {
    baseMessage = err.message
  } else {
    try {
      baseMessage = JSON.stringify(err)
    } catch {
      baseMessage = String(err)
    }
  }

  if (fallbackMessage && fallbackMessage.trim().length > 0) {
    const isUseless = !baseMessage || baseMessage === '[object Object]' || baseMessage === 'undefined' || baseMessage === 'null'
    return isUseless ? fallbackMessage : `${fallbackMessage}: ${baseMessage}`
  }

  return baseMessage
}