
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Input } from '@/components/ui/input';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Variety } from '@/lib/varieties';

const formSchema = z.object({
    name: z.string().min(1, 'Variety name is required.'),
    family: z.string().min(1, 'Plant family is required.'),
    category: z.string().min(1, 'Category is required.'),
});

type VarietyFormValues = z.infer<typeof formSchema>;

interface VarietyFormProps {
  onSubmit: (data: Variety) => void;
  onCancel: () => void;
}

export function VarietyForm({ onSubmit, onCancel }: VarietyFormProps) {
  const form = useForm<VarietyFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        name: '',
        family: '',
        category: '',
    },
  });

  const handleSubmit = (values: VarietyFormValues) => {
    onSubmit(values);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add New Variety</DialogTitle>
        <DialogDescription>
          Add a new plant variety to your golden table.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Variety Name</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., 'Munstead'" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="family"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Plant Family</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., 'Lavender'" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., 'Perennial'" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Add Variety</Button>
          </div>
        </form>
      </Form>
    </>
  );
}
