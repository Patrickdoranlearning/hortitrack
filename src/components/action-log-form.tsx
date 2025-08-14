
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Batch, NurseryLocation, PlantSize, LogEntry } from '@/lib/types';
import { useState } from 'react';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { LogEntrySchema } from '@/lib/types';

const idFromName = (list: {id?: string; name?: string}[], name?: string) =>
  list.find(x => x.name === name)?.id ?? '';

const actionTypeEnum = LogEntrySchema.shape.type;

const formSchema = (maxQuantity: number) => z.object({
  type: actionTypeEnum,
  note: z.string().optional(),
  newLocation: z.string().optional(),
  qty: z.coerce.number().min(1, 'Quantity must be at least 1.').max(maxQuantity, `Cannot exceed remaining stock of ${maxQuantity}.`).optional(),
  reason: z.string().min(1, 'A reason is required for adjustments.').optional(),
}).refine(data => {
    if (data.type === 'NOTE') {
        return !!data.note && data.note.trim().length > 0;
    }
    return true;
}, {
    message: "A note is required.",
    path: ["note"],
}).refine(data => {
    if (data.type === 'MOVE') {
        return !!data.newLocation;
    }
    return true;
}, {
    message: "A new location is required.",
    path: ["newLocation"],
}).refine(data => {
    if (data.type === 'LOSS') {
        return !!data.qty && !!data.reason;
    }
    return true;
}, {
    message: "Quantity and reason are required for adjustments.",
    path: ["qty"],
});


type ActionLogFormValues = z.infer<ReturnType<typeof formSchema>>;

interface ActionLogFormProps {
  batch: Batch | null;
  onSubmit: (data: Partial<LogEntry> & {type: LogEntry['type']}) => void;
  onCancel: () => void;
  nurseryLocations: NurseryLocation[];
  plantSizes: PlantSize[];
}

export function ActionLogForm({
  batch,
  onSubmit,
  onCancel,
  nurseryLocations,
}: ActionLogFormProps) {
  const [actionType, setActionType] = useState<z.infer<typeof actionTypeEnum>>('NOTE');
  
  const form = useForm<ActionLogFormValues>({
    resolver: zodResolver(formSchema(batch?.quantity ?? 0)),
    defaultValues: {
        type: 'NOTE',
        note: '',
        newLocation: '',
        qty: undefined,
        reason: '',
    },
  });

  const handleSubmit = (values: ActionLogFormValues) => {
    onSubmit(values);
  };
  
  const showSubmit = actionType === 'NOTE' || actionType === 'MOVE' || actionType === 'LOSS';

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(
            handleSubmit,
            (errors) => {
              console.error("Action log invalid:", errors);
            }
          )}
          className="space-y-8"
        >
          
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Action Type</FormLabel>
                <Select
                  value={field.value ?? "NOTE"}
                  onValueChange={(v) => {
                    const newType = v as z.infer<typeof actionTypeEnum>;
                    setActionType(newType);
                    form.setValue('type', newType, { shouldDirty: true, shouldValidate: true });
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

          {actionType === 'NOTE' && (
             <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                  <FormItem>
                      <FormLabel>Note</FormLabel>
                      <FormControl>
                          <Textarea placeholder="e.g., 'Pruned dead leaves', 'Applied fertilizer', etc." {...field} />
                      </FormControl>
                      <FormMessage />
                  </FormItem>
              )}
             />
          )}
          
          {actionType === 'MOVE' && (
              <FormField
                control={form.control}
                name="newLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Location</FormLabel>
                    <Select
                      value={idFromName(nurseryLocations, field.value)}
                      onValueChange={(id) => {
                        const selected = nurseryLocations.find(l => l.id === id);
                        field.onChange(selected?.name ?? "");
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a new location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {nurseryLocations.map((location) => (
                          <SelectItem key={location.id} value={location.id!}>
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
          
          {actionType === 'LOSS' && (
            <div className='space-y-8'>
              <FormField
                  control={form.control}
                  name="qty"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>Quantity Lost</FormLabel>
                          <FormControl>
                              <Input type="number" placeholder="e.g., 10" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))} />
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
                    <FormLabel>Reason for Loss</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Dumping, Pest Damage, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Log Action</Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}

    