import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <section
      aria-live="polite"
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-paper px-5 py-10 text-center sm:px-8 sm:py-12"
    >
      {icon && (
        <div
          aria-hidden="true"
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent"
        >
          {icon}
        </div>
      )}
      <h3 className="font-sans text-lg font-semibold leading-snug text-ink">
        {title}
      </h3>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-reading text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </section>
  )
}
