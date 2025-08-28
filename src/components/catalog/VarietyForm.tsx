'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui/form';

const Schema = z.object({
  name: z.string().min(1, 'Name is required'),
  genus: z.string().optional(),
  species: z.string().optional(),
  family: z.string().optional(),
  notes: z.string().optional(),
});

export type VarietyFormData = z.infer<typeof Schema>;

export default function VarietyForm({
  variety,
  onSubmit,
  onCancel,
}: {
  variety?: Partial<VarietyFormData>;
  onSubmit: (data: VarietyFormData) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const form = useForm<VarietyFormData>({
    resolver: zodResolver(Schema),
    defaultValues: {
      name: variety?.name ?? '',
      genus: variety?.genus ?? '',
      species: variety?.species ?? '',
      family: variety?.family ?? '',
      notes: (variety as any)?.notes ?? '',
    },
  });

  const submitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(async (data) => { await onSubmit(data); })}
      >
        <FormField
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl><Input placeholder="e.g. Veronica 'Ulster Blue Dwarf'" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="genus"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Genus</FormLabel>
              <FormControl><Input placeholder="e.g. Veronica" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="species"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Species</FormLabel>
              <FormControl><Input placeholder="e.g. spicata" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="family"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Family</FormLabel>
              <FormControl><Input placeholder="e.g. Plantaginaceae" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl><Input placeholder="Optional notes" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 justify-end pt-2">
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Variety'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
