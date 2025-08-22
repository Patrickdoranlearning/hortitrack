
// src/app/sales/orders/new/page.tsx
"use client";

import { useState } from "react";
import { z } from "zod";
import { CreateOrderSchema } from "@/lib/sales/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Supplier } from "@/lib/types";

type FormValues = z.infer<typeof CreateOrderSchema>;

export default function NewSalesOrderPage({ customers, onOrderCreated }: { customers: Supplier[], onOrderCreated?: () => void }) {
  const { toast } = useToast();
  const [printing, setPrinting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(CreateOrderSchema),
    defaultValues: {
      customerId: "",
      storeId: "",
      autoPrint: true,
      lines: [{ plantVariety: "", size: "", qty: 1, allowSubstitute: false }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

  async function onSubmit(values: FormValues) {
    try {
      const res = await fetch("/api/sales/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message || "Failed to create order");
      toast({ title: "Order created", description: `#${json.data.orderId}` });

      if (values.autoPrint) {
        setPrinting(true);
        const pr = await fetch(`/api/sales/orders/${json.data.orderId}/labels/print`, { method: "POST" });
        const pj = await pr.json();
        if (!pr.ok || !pj?.ok) throw new Error(pj?.error?.message || "Print failed");
        toast({ title: "Labels sent to printer", description: `${pj.data.printed} lines printed` });
      }
      onOrderCreated?.();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Create Sales Order</h1>
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={c.id!} value={c.id!}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="storeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Store / Branch</FormLabel>
                      <FormControl><Input placeholder="e.g. Main Street" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium">Lines</h2>
                  <Button type="button" variant="secondary" onClick={() => append({ plantVariety: "", size: "", qty: 1, allowSubstitute: false })}>
                    + Add line
                  </Button>
                </div>

                <div className="space-y-4">
                  {fields.map((f, idx) => (
                    <div key={f.id} className="grid grid-cols-12 gap-2 items-end">
                      <FormField
                        control={form.control}
                        name={`lines.${idx}.plantVariety`}
                        render={({ field }) => (
                          <FormItem className="col-span-5">
                            <FormLabel>Variety</FormLabel>
                            <FormControl><Input placeholder="e.g., Veronica 'Blue Bomb'" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lines.${idx}.size`}
                        render={({ field }) => (
                          <FormItem className="col-span-3">
                            <FormLabel>Pot size</FormLabel>
                            <FormControl><Input placeholder="10.5cm" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lines.${idx}.qty`}
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Qty</FormLabel>
                            <FormControl><Input type="number" min={1} {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="col-span-2 flex gap-2">
                        <Button type="button" variant="destructive" onClick={() => remove(idx)}>Remove</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                 <FormField
                  control={form.control}
                  name="autoPrint"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 pt-2">
                       <FormControl>
                         <Input type="checkbox" className="h-4 w-4" checked={field.value} onChange={e => field.onChange(e.target.checked)} />
                       </FormControl>
                      <FormLabel htmlFor="autoPrint" className="!mt-0">Auto-print pre-pricing labels on submit</FormLabel>
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={printing}>{printing ? "Printing…" : "Submit & Print"}</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
