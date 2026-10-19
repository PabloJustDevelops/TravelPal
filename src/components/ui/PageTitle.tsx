import type { ReactNode } from 'react'

interface PageTitleProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export default function PageTitle({ title, subtitle, action }: PageTitleProps) {
  return (
    <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
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
