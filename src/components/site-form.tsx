'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SiteSchema, type Site } from '@/lib/types';
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
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const SiteFormSchema = SiteSchema.omit({ id: true, orgId: true, createdAt: true, updatedAt: true });
type SiteFormValues = z.infer<typeof SiteFormSchema>;

interface SiteFormProps {
  site: Site | null;
  onSubmit: (data: Omit<Site, 'id'> | Site) => void;
  onCancel: () => void;
}

const defaultValues: SiteFormValues = {
  name: '',
};

export function SiteForm({ site, onSubmit, onCancel }: SiteFormProps) {
  const isEditing = !!site;

  const form = useForm<SiteFormValues>({
    resolver: zodResolver(SiteFormSchema),
    defaultValues: site ? { name: site.name } : defaultValues,
  });

  useEffect(() => {
    if (site) {
      form.reset({ name: site.name });
    } else {
      form.reset(defaultValues);
    }
  }, [site, form]);

  const handleSubmit = form.handleSubmit((values) => {
    if (isEditing && site?.id) {
      onSubmit({ ...site, ...values });
    } else {
      onSubmit(values as Omit<Site, 'id'>);
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Site' : 'Add Site'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the site name. Locations assigned to this site will remain linked.'
              : 'Create a new site to group nursery locations by physical location.'}
          </DialogDescription>
        </DialogHeader>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Site Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Main Nursery, North Field" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">{isEditing ? 'Save Changes' : 'Create Site'}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
