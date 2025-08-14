
"use client";

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { NurseryLocation } from "@/lib/types";
import { DialogFooter } from "./ui/dialog";

// This schema is for client-side form validation.
const NoteLog = z.object({
  type: z.literal("NOTE"),
  note: z.string().min(1, "Please add a note."),
});

// Make this a plain ZodObject (no .refine here)
const MoveLog = z.object({
  type: z.literal("MOVE"),
  // prefer ID; keep name for backward compatibility
  newLocationId: z.string().optional(),
  newLocation: z.string().optional(),
  note: z.string().optional(),
});

const LossLog = z.object({
  type: z.literal("LOSS"),
  qty: z.coerce.number().min(1, "Enter a quantity greater than 0"),
  reason: z.string().optional(),
  note: z.string().optional(),
});

// Build the discriminated union FIRST
const ActionLogSchemaBase = z.discriminatedUnion("type", [
  NoteLog,
  MoveLog,
  LossLog,
]);

// Then add cross-field validation that only runs for MOVE
const ActionLogSchema = ActionLogSchemaBase.superRefine((val, ctx) => {
  if (val.type === "MOVE") {
    const hasId = Boolean(val.newLocationId && val.newLocationId.trim());
    const hasName = Boolean(val.newLocation && val.newLocation.trim());
    if (!hasId && !hasName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a new location",
        path: ["newLocation"], // matches the old UI error target
      });
    }
  }
});

type ActionLogFormValues = z.infer<typeof ActionLogSchema>;

function idFromName(list: NurseryLocation[], name?: string) {
  return list.find((x) => x.name === name)?.id ?? "";
}

export function ActionLogForm({
  batch,
  nurseryLocations,
  onSubmit,
  onCancel,
}: {
  batch: { id: string; quantity?: number } | null | undefined;
  nurseryLocations: NurseryLocation[];
  onSubmit: (values: ActionLogFormValues) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const form = useForm<ActionLogFormValues>({
    resolver: zodResolver(ActionLogSchema),
    mode: "onChange",
    defaultValues: {
      type: "NOTE", // always set to prevent undefined
      note: "",
      newLocation: "",
      newLocationId: "",
      // @ts-expect-error: start empty; z.coerce will handle when used
      qty: undefined,
      reason: "",
    },
  });

  const type = form.watch("type") ?? "NOTE";

  const handleValid = async (values: ActionLogFormValues) => {
    if (values.type === "LOSS" && typeof values.qty === "number") {
      const available = Number(batch?.quantity ?? 0);
      if (values.qty > available) {
        form.setError("qty" as any, {
          type: "validate",
          message: `Quantity exceeds available (${available}).`,
        });
        return;
      }
    }
    await onSubmit(values);
    form.reset({ type: "NOTE", note: "" } as any);
  };

  const handleInvalid = (errors: any) => {
    console.error("Action log invalid:", errors);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleValid, handleInvalid)}
        className="space-y-6"
      >
        {/* Action Type */}
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Action Type</FormLabel>
              <Select
                value={field.value ?? "NOTE"}
                onValueChange={(v) => {
                  field.onChange(v as any);
                  form.clearErrors();
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an action type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="NOTE">General Note</SelectItem>
                  <SelectItem value="MOVE">Move Batch</SelectItem>
                  <SelectItem value="LOSS">Log Loss</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* NOTE */}
        {type === "NOTE" && (
          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Note</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Add a note..."
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* MOVE */}
        {type === "MOVE" && (
          <FormField
            control={form.control}
            name="newLocation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Location</FormLabel>
                <Select
                  value={idFromName(nurseryLocations, field.value)}
                  onValueChange={(id) => {
                    const selected = nurseryLocations.find((l) => l.id === id);
                    form.setValue("newLocationId", id);
                    field.onChange(selected?.name ?? "");
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a new location" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {nurseryLocations.map((location, i) => (
                      <SelectItem
                        key={location.id ?? `loc-${i}`}
                        value={location.id ?? `loc-${i}`}
                      >
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* LOSS */}
        {type === "LOSS" && (
          <>
            <FormField
              control={form.control}
              name="qty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loss Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      min={1}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (optional)</FormLabel>
                  <FormControl>
                    <Input
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="e.g. disease, weather damage"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Log Action</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
