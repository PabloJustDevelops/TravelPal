export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastPayload {
  type: ToastType
  title?: string
  dismissLabel?: string
  message: string
  durationMs?: number
}

export function showToast(payload: ToastPayload) {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('app:toast', { detail: payload })
    window.dispatchEvent(event)
  }
}