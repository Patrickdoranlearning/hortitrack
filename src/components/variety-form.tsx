
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';
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
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { type Variety, VarietySchema } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

// Lazy load gallery to avoid slowing down form load
const VarietyGallerySection = dynamic(
  () => import('@/components/varieties/VarietyGallerySection'),
  { 
    loading: () => <div className="text-sm text-muted-foreground py-4">Loading photos...</div>,
    ssr: false 
  }
);

type VarietyFormValues = z.infer<typeof VarietySchema>;

interface VarietyFormProps {
  variety: Variety | null;
  onSubmit: (data: VarietyFormValues) => void;
  onCancel: () => void;
  saving?: boolean;
}

export function VarietyForm({ variety, onSubmit, onCancel, saving }: VarietyFormProps) {
  const isEditing = !!variety?.id;

  const form = useForm<VarietyFormValues>({
    resolver: zodResolver(VarietySchema),
    defaultValues: variety || {
        name: '',
        commonName: '',
        family: '',
        genus: '',
        species: '',
        category: '',
        colour: '',
        floweringPeriod: '',
        flowerColour: '',
        evergreen: undefined,
        plantBreedersRights: undefined,
        rating: undefined,
    },
  });

  useEffect(() => {
    form.reset(variety || {
        name: '',
        commonName: '',
        family: '',
        genus: '',
        species: '',
        category: '',
        colour: '',
        floweringPeriod: '',
        flowerColour: '',
        evergreen: undefined,
        plantBreedersRights: undefined,
        rating: undefined,
    });
  }, [variety, form]);

  const handleSubmit = (values: VarietyFormValues) => {
    onSubmit(values);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit Variety' : 'Add New Variety'}</DialogTitle>
        <DialogDescription>
          {isEditing && variety ? `Editing the details for "${variety.name}".` : 'Add a new plant variety to your golden table.'}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <ScrollArea className="h-[60vh] pr-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Variety Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., 'Munstead'"
                              value={field.value ?? ''}
                              onChange={(event) => field.onChange(event.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="commonName" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Common Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., 'English Lavender'"
                              value={field.value ?? ''}
                              onChange={(event) => field.onChange(event.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="family" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Plant Family</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., 'Lamiaceae'"
                              value={field.value ?? ''}
                              onChange={(event) => field.onChange(event.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="genus" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Genus</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., 'Lavandula'"
                              value={field.value ?? ''}
                              onChange={(event) => field.onChange(event.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="species" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Species</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., 'angustifolia'"
                              value={field.value ?? ''}
                              onChange={(event) => field.onChange(event.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="category" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Category</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., 'Perennial'"
                              value={field.value ?? ''}
                              onChange={(event) => field.onChange(event.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="colour" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Foliage Colour</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., 'Grey-green'"
                              value={field.value ?? ''}
                              onChange={(event) => field.onChange(event.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="flowerColour" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Flower Colour</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., 'Purple'"
                              value={field.value ?? ''}
                              onChange={(event) => field.onChange(event.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="floweringPeriod" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Flowering Period</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., 'Summer'"
                              value={field.value ?? ''}
                              onChange={(event) => field.onChange(event.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="evergreen" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Evergreen</FormLabel>
                          <Select
                              value={field.value === undefined ? "unknown" : field.value ? "yes" : "no"}
                              onValueChange={(value) =>
                                field.onChange(
                                  value === "unknown" ? undefined : value === "yes"
                                )
                              }
                          >
                              <FormControl>
                                  <SelectTrigger>
                                      <SelectValue placeholder="Evergreen?" />
                                  </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                  <SelectItem value="unknown">Unspecified</SelectItem>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="plantBreedersRights" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Plant Breeders Rights</FormLabel>
                          <Select
                              value={field.value === undefined ? "unknown" : field.value ? "yes" : "no"}
                              onValueChange={(value) =>
                                field.onChange(
                                  value === "unknown" ? undefined : value === "yes"
                                )
                              }
                          >
                              <FormControl>
                                  <SelectTrigger>
                                      <SelectValue placeholder="PBR?" />
                                  </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                  <SelectItem value="unknown">Unspecified</SelectItem>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                  )} />
                   <FormField control={form.control} name="rating" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Rating</FormLabel>
                          <FormControl>
                              <Input
                                  type="number"
                                  min={1}
                                  max={6}
                                  placeholder="1-6"
                                  value={field.value ?? ""}
                                  onChange={(event) =>
                                      field.onChange(event.target.value === "" ? undefined : Number(event.target.value))
                                  }
                              />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
              </div>

              {/* Gallery Section - only show when editing existing variety */}
              {isEditing && variety?.id && (
                <>
                  <Separator className="my-6" />
                  <VarietyGallerySection varietyId={variety.id} />
                </>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="pt-6">
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
                Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Variety'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
