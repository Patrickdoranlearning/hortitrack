"use client";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export type DraftBatch = {
  id: string;
  sku: string;
  sellWeek: number;
  quantity: number;
  recipeVersion?: string;
  predictedReadyWeek: number;
};

const FormSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  sellWeek: z.coerce.number().int().min(1).max(52, "Week must be between 1 and 52"),
  quantity: z.coerce.number().int().positive(),
  recipeVersion: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface Props {
  onCreate: (batch: DraftBatch) => void;
}

export function NewDraftBatchDialog({ onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(FormSchema), defaultValues: { sku: "", quantity: 1 } });

  const sellWeek = form.watch("sellWeek");
  const predictedReadyWeek = sellWeek ? Math.max(1, sellWeek - 2) : undefined;

  function onSubmit(values: FormValues) {
    const batch: DraftBatch = {
      id: uuidv4(),
      sku: values.sku,
      sellWeek: values.sellWeek,
      quantity: values.quantity,
      recipeVersion: values.recipeVersion,
      predictedReadyWeek: predictedReadyWeek ?? values.sellWeek,
    };
    onCreate(batch);
    setOpen(false);
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> New Draft Batch
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Draft Batch</DialogTitle>
          <DialogDescription>Create a draft batch and preview its predicted ready week.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Lavender 10cm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sellWeek"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Sell Week</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={52} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="recipeVersion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipe Version</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="optional" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {predictedReadyWeek && (
              <p className="text-sm text-muted-foreground">Predicted Ready Week: Week {predictedReadyWeek}</p>
            )}
            <DialogFooter className="pt-2">
              <Button type="submit">Create Draft</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
