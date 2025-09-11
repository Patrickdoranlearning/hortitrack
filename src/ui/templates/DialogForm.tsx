"use client"

import * as React from "react"
import { z, ZodTypeAny } from "zod"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type DialogFormProps<Schema extends ZodTypeAny> = {
  title: string
  description?: string
  trigger: React.ReactNode
  schema: Schema
  defaultValues: z.infer<Schema>
  onSubmit: (values: z.infer<Schema>) => Promise<void> | void
  submitLabel?: string
  secondaryAction?: React.ReactNode
  children: (args: { form: ReturnType<typeof useForm<z.infer<Schema>>> }) => React.ReactNode
}

export function DialogForm<Schema extends ZodTypeAny>({
  title,
  description,
  trigger,
  schema,
  defaultValues,
  onSubmit,
  submitLabel = "Save",
  secondaryAction,
  children,
}: DialogFormProps<Schema>) {
  const form = useForm<z.infer<Schema>>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onBlur",
  })
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit: SubmitHandler<z.infer<Schema>> = async (values) => {
    setBusy(true)
    setError(null)
    try {
      await onSubmit(values)
      setOpen(false)
      form.reset(defaultValues) // reset after success to avoid dirty state next open
    } catch (e: any) {
      console.error("DialogForm submit failed", e)
      setError(e?.message ?? "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4"
          aria-describedby={description ? "dialog-desc" : undefined}
        >
          {children({ form })}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

          <DialogFooter className="gap-2">
            {secondaryAction}
            <Button type="submit" variant="accent" disabled={busy}>
              {busy ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
