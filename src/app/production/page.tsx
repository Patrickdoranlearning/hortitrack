
"use client"

import * as React from "react"
import { z } from "zod"
import { PageFrame } from "@/ui/templates/PageFrame"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DialogForm } from "@/ui/templates/DialogForm"

const tabs = [
  { label: "Dashboard", href: "/production" , exact: true},
  { label: "Batches", href: "/production/batches" },
  { label: "Propagation", href: "/production/propagation" },
  { label: "Potting", href: "/production/potting" },
  { label: "Planning", href: "/production/planning"},
  { label: "Reports", href: "/production/reports" },
]

const newBatchSchema = z.object({
  variety: z.string().min(1, "Required"),
  family: z.string().min(1, "Required"),
  size: z.string().min(1, "Required"),
  initialQty: z.coerce.number().int().positive("Must be > 0"),
})

export default function ProductionHome() {
  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="production" moduleTabs={tabs}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl">Production</h1>
        <DialogForm
          title="New Batch"
          description="Create a new batch for production."
          schema={newBatchSchema}
          defaultValues={{ variety: "", family: "", size: "", initialQty: 0 }}
          trigger={<Button variant="accent">New Batch</Button>}
          onSubmit={async (values) => {
            // TODO: call server action or API
            // await createBatch(values)
            console.log("Create batch", values)
          }}
        >
          {({ form }) => (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="variety">Variety</Label>
                <Input id="variety" {...form.register("variety")} />
                <FieldError msg={form.formState.errors.variety?.message} />
              </div>
              <div>
                <Label htmlFor="family">Family</Label>
                <Input id="family" {...form.register("family")} />
                <FieldError msg={form.formState.errors.family?.message} />
              </div>
              <div>
                <Label htmlFor="size">Pot Size</Label>
                <Input id="size" {...form.register("size")} />
                <FieldError msg={form.formState.errors.size?.message} />
              </div>
              <div>
                <Label htmlFor="initialQty">Initial Quantity</Label>
                <Input id="initialQty" type="number" {...form.register("initialQty", { valueAsNumber: true })} />
                <FieldError msg={form.formState.errors.initialQty?.message} />
              </div>
            </div>
          )}
        </DialogForm>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Batches in Propagation</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">124</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Ready for Sale</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">8,940</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Loss (last 7 days)</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">2.1%</CardContent>
        </Card>
      </div>
    </PageFrame>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-red-600">{msg}</p>
}
