'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon, Package } from 'lucide-react'

/**
 * EmptyState Template
 *
 * A placeholder component for empty lists, tables, or sections.
 * Use this when there's no data to display.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={Package}
 *   title="No orders yet"
 *   description="Create your first order to get started."
 *   action={<Button onClick={handleCreate}>Create Order</Button>}
 * />
 * ```
 */

type EmptyStateProps = {
  /** Icon to display (default: Package) */
  icon?: LucideIcon
  /** Main heading */
  title: string
  /** Supporting description */
  description?: string
  /** Optional action button or element */
  action?: React.ReactNode
  /** Additional CSS classes */
  className?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: {
    container: 'py-6',
    icon: 'h-8 w-8',
    title: 'text-base',
    description: 'text-sm',
  },
  md: {
    container: 'py-12',
    icon: 'h-12 w-12',
    title: 'text-lg',
    description: 'text-sm',
  },
  lg: {
    container: 'py-16',
    icon: 'h-16 w-16',
    title: 'text-xl',
    description: 'text-base',
  },
}

export function EmptyState({
  icon: Icon = Package,
  title,
  description,
  action,
  className,
  size = 'md',
}: EmptyStateProps) {
  const classes = sizeClasses[size]

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        classes.container,
        className
      )}
    >
      <div className="rounded-full bg-muted p-4">
        <Icon className={cn('text-muted-foreground', classes.icon)} />
      </div>
      <h3 className={cn('mt-4 font-semibold', classes.title)}>{title}</h3>
      {description && (
        <p className={cn('mt-1 text-muted-foreground max-w-md', classes.description)}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
