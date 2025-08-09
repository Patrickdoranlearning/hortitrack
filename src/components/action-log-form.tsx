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
import type { Batch } from '@/lib/types';
import { useState } from 'react';

const formSchema = (maxQuantity: number) => z.object({
  actionType: z.enum(['log', 'move', 'split', 'adjust', 'Batch Spaced', 'Batch Trimmed']),
  logMessage: z.string().optional(),
  newLocation: z.string().optional(),
  splitQuantity: z.number().positive().optional(),
  newBatchPlantingDate: z.string().optional(),
  adjustQuantity: z.coerce.number().min(1, 'Quantity must be at least 1.').max(maxQuantity, `Cannot exceed remaining stock of ${maxQuantity}.`).optional(),
  adjustReason: z.string().min(1, 'A reason is required for adjustments.').optional(),
}).refine(data => {
    if (data.actionType === 'split') {
        return !!data.splitQuantity && !!data.newLocation && !!data.newBatchPlantingDate;
    }
    if (data.actionType === 'adjust') {
        return !!data.adjustQuantity && !!data.adjustReason;
    }
    return true;
}, {
    message: "All fields for the selected action are required.",
    path: ["actionType"],
});


type ActionLogFormValues = z.infer<ReturnType<typeof formSchema>>;

interface ActionLogFormProps {
  batch: Batch | null;
  onSubmit: (data: ActionLogFormValues) => void;
  onCancel: () => void;
  nurseryLocations: string[];
  plantSizes: string[];
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
        splitQuantity: 0,
        newBatchPlantingDate: new Date().toISOString().split('T')[0],
        adjustQuantity: 1,
        adjustReason: '',
    },
  });

  const handleSubmit = (values: ActionLogFormValues) => {
    onSubmit(values);
  };
  
  const handleActionTypeChange = (value: string) => {
    setActionType(value);
    form.setValue('actionType', value as 'log' | 'move' | 'split' | 'adjust' | 'Batch Spaced' | 'Batch Trimmed');
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <h2 className="text-2xl font-bold">Log Action for Batch #{batch?.batchNumber}</h2>
        
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
                  <SelectItem value="split">Split Batch</SelectItem>
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
                        <SelectItem key={location} value={location}>{location}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
        )}

        {actionType === 'split' && (
          <>
            <FormField
                control={form.control}
                name="splitQuantity"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Quantity to Split</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="e.g., 25" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
              control={form.control}
              name="newLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Location for Split Batch</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select new location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {nurseryLocations.map(location => (
                        <SelectItem key={location} value={location}>{location}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="newBatchPlantingDate"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Planting Date for New Batch</FormLabel>
                        <FormControl>
                            <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
          </>
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
                            <Input type="number" placeholder="e.g., 10" {...field} />
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


        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Log Action</Button>
        </div>
      </form>
    </Form>
  );
}
