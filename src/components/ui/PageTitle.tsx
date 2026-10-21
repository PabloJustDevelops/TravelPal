import type { ReactNode } from 'react'

interface PageTitleProps {
  className?: string
  title: string
  subtitle?: string
  action?: ReactNode
}

export default function PageTitle({ title, subtitle, action, className = '' }: PageTitleProps) {
  return (
    <div data-loading-slot={className ? "title" : undefined} className={`flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="min-w-0">
        <h1 className="font-sans text-[28px] font-bold leading-[1.14] tracking-tight text-ink sm:text-[38px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-base leading-reading sm:text-lg text-muted">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}
