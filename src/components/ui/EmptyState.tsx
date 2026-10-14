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
      className="flex flex-col items-start rounded-xl border border-line bg-paper px-6 py-8 text-left sm:px-8 sm:py-10"
    >
      {icon && (
        <div
          aria-hidden="true"
          className="mb-5 text-muted [&>svg]:h-7 [&>svg]:w-7"
        >
          {icon}
        </div>
      )}
      <h2 className="font-sans text-lg font-semibold leading-snug text-ink">
        {title}
      </h2>
      {description && (
        <p className="mt-2 max-w-lg text-sm leading-reading text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </section>
  )
}
