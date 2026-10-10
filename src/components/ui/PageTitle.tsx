import type { ReactNode } from 'react'

interface PageTitleProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export default function PageTitle({ title, subtitle, action }: PageTitleProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-sans font-bold tracking-tight text-title leading-tight text-ink sm:text-display">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-base leading-reading text-muted">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}
