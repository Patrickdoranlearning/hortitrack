'use client'

import * as React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button, type ButtonProps } from '@/components/ui/button'

/**
 * ConfirmDialog Template
 *
 * A confirmation dialog for destructive or important actions.
 * Wraps AlertDialog with common patterns for confirm/cancel flows.
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   title="Delete item?"
 *   description="This action cannot be undone."
 *   onConfirm={() => handleDelete(id)}
 *   confirmLabel="Delete"
 *   variant="destructive"
 * >
 *   <Button variant="destructive">Delete</Button>
 * </ConfirmDialog>
 * ```
 */

type ConfirmDialogProps = {
  /** Dialog title */
  title: string
  /** Dialog description */
  description: string
  /** Trigger element (typically a Button) */
  children: React.ReactNode
  /** Called when user confirms */
  onConfirm: () => void | Promise<void>
  /** Confirm button label (default: "Confirm") */
  confirmLabel?: string
  /** Cancel button label (default: "Cancel") */
  cancelLabel?: string
  /** Confirm button variant (default: "default") */
  variant?: ButtonProps['variant']
  /** Disable the confirm button */
  disabled?: boolean
}

export function ConfirmDialog({
  title,
  description,
  children,
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  disabled = false,
}: ConfirmDialogProps) {
  const [busy, setBusy] = React.useState(false)

  const handleConfirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={disabled || busy}
            className={
              variant === 'destructive'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : undefined
            }
          >
            {busy ? 'Processing...' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
