
"use client"

import * as React from "react"
import { z } from "zod"
import { PageFrame } from "@/ui/templates/PageFrame"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DialogForm } from "@/ui/templates/DialogForm"
import { createPropagationBatchAction } from "@/app/actions/production"
import { useToast } from "@/hooks/use-toast"

// Match the backend PropagationFormSchema requirements
const newBatchSchema = z.object({
  variety: z.string().min(1, "Required"),
  family: z.string().optional(),
  sizeId: z.string().min(1, "Required"), // Treat as Size Name for now if IDs not available
  sizeMultiple: z.coerce.number().int().positive("Must be > 0"),
  fullTrays: z.coerce.number().int().min(0),
  partialCells: z.coerce.number().int().min(0).default(0),
  locationId: z.string().min(1, "Required"),
  plantingDate: z.string().min(1, "Required"), // Date picker would be better
})

export default function ProductionHome() {
  const { toast } = useToast()

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="production">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl">Production</h1>
        <DialogForm
          title="New Propagation Batch"
          description="Start a new batch from propagation (seed/cuttings)."
          schema={newBatchSchema}
          defaultValues={{
            variety: "",
            family: "",
            sizeId: "",
            sizeMultiple: 1,
            fullTrays: 0,
            partialCells: 0,
            locationId: "",
            plantingDate: new Date().toISOString().split('T')[0]
          }}
          trigger={<Button variant="accent">New Batch</Button>}
          onSubmit={async (values) => {
            const res = await createPropagationBatchAction({
              ...values,
              family: values.family || null,
              // If specific fields are missing/optional in schema but required by action, handle here
            })
            
            if (res.success) {
                toast({ title: "Batch Created", description: `Batch ${res.data?.batch_number} started.` })
            } else {
                toast({ title: "Error", description: res.error || "Failed to create batch", variant: "destructive" })
            }
          }}
        >
          {({ form }) => (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="col-span-2">
                <Label htmlFor="variety">Variety</Label>
                <Input id="variety" {...form.register("variety")} placeholder="e.g. Lavandula angustifolia" />
                <FieldError msg={form.formState.errors.variety?.message} />
              </div>
              
              <div>
                <Label htmlFor="family">Family (Optional)</Label>
                <Input id="family" {...form.register("family")} placeholder="e.g. Lamiaceae" />
                <FieldError msg={form.formState.errors.family?.message} />
              </div>

              <div>
                 <Label htmlFor="plantingDate">Planting Date</Label>
                 <Input id="plantingDate" type="date" {...form.register("plantingDate")} />
                 <FieldError msg={form.formState.errors.plantingDate?.message} />
              </div>

              <div>
                <Label htmlFor="sizeId">Size / Container</Label>
                <Input id="sizeId" {...form.register("sizeId")} placeholder="e.g. 54-cell" />
                <FieldError msg={form.formState.errors.sizeId?.message} />
              </div>

               <div>
                <Label htmlFor="sizeMultiple">Cells per Tray</Label>
                <Input id="sizeMultiple" type="number" {...form.register("sizeMultiple", { valueAsNumber: true })} />
                <FieldError msg={form.formState.errors.sizeMultiple?.message} />
              </div>

              <div>
                <Label htmlFor="fullTrays">Full Trays</Label>
                <Input id="fullTrays" type="number" {...form.register("fullTrays", { valueAsNumber: true })} />
                <FieldError msg={form.formState.errors.fullTrays?.message} />
              </div>
              
              <div>
                <Label htmlFor="partialCells">Partial Cells</Label>
                <Input id="partialCells" type="number" {...form.register("partialCells", { valueAsNumber: true })} />
                <FieldError msg={form.formState.errors.partialCells?.message} />
              </div>

              <div className="col-span-2">
                <Label htmlFor="locationId">Location</Label>
                <Input id="locationId" {...form.register("locationId")} placeholder="e.g. Greenhouse 1" />
                <FieldError msg={form.formState.errors.locationId?.message} />
              </div>
            </div>
          )}
        </DialogForm>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Batches in Propagation</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">--</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Ready for Sale</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">--</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Loss (last 7 days)</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">--</CardContent>
        </Card>
      </div>
    </PageFrame>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-red-600">{msg}</p>
}
