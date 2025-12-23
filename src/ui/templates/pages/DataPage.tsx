'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * DataPage Template
 *
 * A full-page template for data management screens (CRUD operations).
 * Use this for pages that display tabular data with filtering, sorting,
 * and bulk operations (import/export).
 *
 * @example
 * ```tsx
 * <DataPage
 *   title="Plant Sizes"
 *   description="Manage pot, tray, and bareroot sizes."
 *   toolbar={<DataToolbar ... />}
 *   backHref="/settings"
 * >
 *   <Card>
 *     <Table>...</Table>
 *   </Card>
 * </DataPage>
 * ```
 */

type DataPageProps = {
  /** Page title displayed as h1 */
  title: string
  /** Optional description below the title */
  description?: string
  /** Main content (typically a Card with Table) */
  children: React.ReactNode
  /** Toolbar component (typically DataToolbar) */
  toolbar?: React.ReactNode
  /** Additional CSS classes */
  className?: string
  /** Back button destination (default: '/settings') */
  backHref?: string
  /** Custom back button label */
  backLabel?: string
  /** Additional actions to show in the header */
  headerActions?: React.ReactNode
}

export function DataPage({
  title,
  description,
  children,
  toolbar,
  className,
  backHref = '/settings',
  backLabel = 'Back to Data Management',
  headerActions,
}: DataPageProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl">{title}</h1>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {headerActions}
          {backHref && (
            <Button asChild variant="outline">
              <Link href={backHref}>{backLabel}</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      {toolbar}

      {/* Content */}
      {children}
    </div>
  )
}
