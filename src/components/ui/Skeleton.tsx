import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import styles from './skeleton.module.css'

export const SKELETON_TEST_IDS = {
  block: 'skeleton',
  text: 'skeleton-text',
  card: 'skeleton-card',
  page: 'page-skeleton',
} as const

type Props = HTMLAttributes<HTMLDivElement> & { 'data-testid'?: string }

export function Skeleton({ className, ...props }: Props) {
  return <div {...props} data-testid={props['data-testid'] ?? SKELETON_TEST_IDS.block} aria-hidden="true" className={cn(styles.shape, 'h-4 rounded', className)} />
}

export function SkeletonText({ lines = 3, className, ...props }: Props & { lines?: number }) {
  return (
    <div {...props} data-testid={SKELETON_TEST_IDS.text} aria-hidden="true" className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, index) => <Skeleton key={index} className={index === lines - 1 ? 'w-2/3' : 'w-full'} />)}
    </div>
  )
}

export function SkeletonCard({ className, children, ...props }: Props) {
  return (
    <div {...props} data-testid={SKELETON_TEST_IDS.card} aria-hidden="true" className={cn('rounded-xl border border-line bg-paper p-5 space-y-4', className)}>
      {children ?? <><Skeleton className="h-6 w-1/2" /><SkeletonText /></>}
    </div>
  )
}
