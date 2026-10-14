import type { ReactNode } from 'react'

interface PageTitleProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export default function PageTitle({ title, subtitle, action }: PageTitleProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-sans text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm leading-reading text-muted">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}
