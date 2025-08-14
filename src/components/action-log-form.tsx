"use client";

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Batch, NurseryLocation, PlantSize, LogEntry } from '@/lib/types';
import { DialogFooter } from './ui/dialog';
import { ActionLogSchema, ActionLogFormValues } from "@/lib/types";

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
      type: "NOTE",
      note: "",
    },
  });

  const type = form.watch("type");

  const handleValid = async (values: ActionLogFormValues) => {
    // optional guard: prevent loss > available
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
    form.reset();
  };

  const handleInvalid = (errors: any) => {
    // This fires only when validation FAILS
    // If you saw "Action log invalid: {}", it means the handler wiring was wrong
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
                  // switch type and clear previous errors
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

        {/* NOTE fields */}
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

        {/* MOVE fields */}
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

        {/* LOSS fields */}
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
