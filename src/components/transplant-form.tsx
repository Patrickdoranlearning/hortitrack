'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Batch, TransplantFormData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const transplantFormSchema = z.object({
  id: z.string(),
  batchNumber: z.string().min(1, 'Batch number is required.'),
  plantType: z.string(),
  plantingDate: z.string().min(1, 'Planting date is required.'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  status: z.enum(['Potted', 'Ready for Sale']),
  location: z.string().min(1, 'Location is required.'),
  transplantedFrom: z.string(),
  logHistory: z.array(z.object({
    date: z.string(),
    action: z.string(),
  })),
});

type TransplantFormValues = z.infer<typeof transplantFormSchema>;

interface TransplantFormProps {
  batch: Batch | null;
  onSubmit: (data: Omit<Batch, 'id'>) => void;
  onCancel: () => void;
}

export function TransplantForm({ batch, onSubmit, onCancel }: TransplantFormProps) {
  const form = useForm<TransplantFormValues>({
    resolver: zodResolver(transplantFormSchema),
    defaultValues: batch
      ? {
          id: '',
          batchNumber: '',
          plantType: batch.plantType,
          plantingDate: new Date().toISOString(),
          quantity: batch.quantity,
          status: 'Potted',
          location: '',
          transplantedFrom: batch.batchNumber,
          logHistory: [{date: new Date().toISOString(), action: `Transplanted from batch #${batch.batchNumber}`}]
        }
      : undefined,
  });

  const handleFormSubmit = (data: TransplantFormValues) => {
    const batchNumberPrefix = {
      'Potted': '3',
      'Ready for Sale': '4'
    };
    const prefixedBatchNumber = `${batchNumberPrefix[data.status]}-${data.batchNumber}`;
    const { id, ...rest } = data;
    onSubmit({ ...rest, batchNumber: prefixedBatchNumber });
  };
  
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-headline text-2xl">Transplant Batch</DialogTitle>
        <DialogDescription>
          Create a new batch from an existing one. Original batch is #{batch?.batchNumber}.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="batchNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Batch Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 54321" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="plantType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plant Type</FormLabel>
                  <FormControl>
                    <Input {...field} disabled />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Location</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Shady Area" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="plantingDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Transplant Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(new Date(field.value), 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date) => field.onChange(date?.toISOString())}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
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
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Potted">Potted</SelectItem>
                      <SelectItem value="Ready for Sale">Ready for Sale</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Create Transplanted Batch</Button>
          </div>
        </form>
      </Form>
    </>
  );
}
