
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
import type { Batch, NurseryLocation, PlantSize } from '@/lib/types';
import { useState } from 'react';
import { DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

const formSchema = (maxQuantity: number) => z.object({
  actionType: z.enum(['log', 'move', 'adjust', 'Batch Spaced', 'Batch Trimmed']),
  logMessage: z.string().optional(),
  newLocation: z.string().optional(),
  adjustQuantity: z.coerce.number().min(1, 'Quantity must be at least 1.').max(maxQuantity, `Cannot exceed remaining stock of ${maxQuantity}.`).optional(),
  adjustReason: z.string().min(1, 'A reason is required for adjustments.').optional(),
}).refine(data => {
    if (data.actionType === 'log') {
        return !!data.logMessage && data.logMessage.trim().length > 0;
    }
    return true;
}, {
    message: "A log message is required.",
    path: ["logMessage"],
}).refine(data => {
    if (data.actionType === 'move') {
        return !!data.newLocation;
    }
    return true;
}, {
    message: "A new location is required.",
    path: ["newLocation"],
}).refine(data => {
    if (data.actionType === 'adjust') {
        return !!data.adjustQuantity && !!data.adjustReason;
    }
    return true;
}, {
    message: "Quantity and reason are required for adjustments.",
    path: ["adjustQuantity"],
});


type ActionLogFormValues = z.infer<ReturnType<typeof formSchema>>;

interface ActionLogFormProps {
  batch: Batch | null;
  onSubmit: (data: any) => void;
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
  const [actionType, setActionType] = useState('log');
  
  const form = useForm<ActionLogFormValues>({
    resolver: zodResolver(formSchema(batch?.quantity ?? 0)),
    defaultValues: {
        actionType: 'log',
        logMessage: '',
        newLocation: '',
        adjustQuantity: undefined,
        adjustReason: '',
    },
  });

  const handleSubmit = (values: ActionLogFormValues) => {
    onSubmit(values);
  };
  
  const handleActionTypeChange = (value: string) => {
    setActionType(value);
    form.setValue('actionType', value as 'log' | 'move' | 'adjust' | 'Batch Spaced' | 'Batch Trimmed');
    form.clearErrors();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Log Action for Batch #{batch?.batchNumber}</DialogTitle>
        <DialogDescription>
          Record a new activity or update for this batch. The action will be added to the log history.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          
          <FormField
            control={form.control}
            name="actionType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Action Type</FormLabel>
                <Select onValueChange={handleActionTypeChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an action type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="log">General Log</SelectItem>
                    <SelectItem value="move">Move Batch</SelectItem>
                    <SelectItem value="adjust">Adjust Stock (Losses)</SelectItem>
                    <SelectItem value="Batch Spaced">Batch Spaced</SelectItem>
                    <SelectItem value="Batch Trimmed">Batch Trimmed</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {actionType === 'log' && (
             <FormField
              control={form.control}
              name="logMessage"
              render={({ field }) => (
                  <FormItem>
                      <FormLabel>Log Message</FormLabel>
                      <FormControl>
                          <Textarea placeholder="e.g., 'Pruned dead leaves', 'Applied fertilizer', etc." {...field} />
                      </FormControl>
                      <FormMessage />
                  </FormItem>
              )}
             />
          )}
          
          {actionType === 'move' && (
              <FormField
                control={form.control}
                name="newLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Location</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select new location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {nurseryLocations.map(location => (
                          <SelectItem key={location.id} value={location.name}>{location.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
          )}
          
          {actionType === 'adjust' && (
            <>
              <FormField
                  control={form.control}
                  name="adjustQuantity"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>Quantity to Remove</FormLabel>
                          <FormControl>
                              <Input type="number" placeholder="e.g., 10" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))} />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )}
              />
              <FormField
                control={form.control}
                name="adjustReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Adjustment</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Dumping, Pest Damage, etc." {...field} />
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
    </>
  );
}
