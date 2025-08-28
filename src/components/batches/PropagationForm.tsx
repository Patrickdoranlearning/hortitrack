'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCatalog } from '@/hooks/useCatalog';
import { Button } from '@/components/ui/button';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

const Schema = z.object({
  variety_id: z.string().min(1),
  size_id: z.string().min(1),
  location_id: z.string().min(1),
  trays: z.coerce.number().int().min(0),
  planted_at: z.string().min(1),
});

export default function PropagationForm({ orgId }: { orgId?: string }) {
  const { varieties, sizes, locations } = useCatalog(orgId);
  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: { variety_id: '', size_id: '', location_id: '', trays: 0, planted_at: new Date().toISOString().slice(0,10) },
  });

  return (
    <Form {...form}>
      <form className="space-y-4">
        <FormField name="variety_id" render={({ field }) => (
          <FormItem>
            <FormLabel>Variety</FormLabel>
            <FormControl>
              <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={varieties.isLoading}>
                <SelectTrigger><SelectValue placeholder="Select variety" /></SelectTrigger>
                <SelectContent>
                  {(varieties.data ?? []).map((v:any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField name="size_id" render={({ field }) => (
          <FormItem>
            <FormLabel>Tray Size</FormLabel>
            <FormControl>
              <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={sizes.isLoading}>
                <SelectTrigger><SelectValue placeholder="Select tray" /></SelectTrigger>
                <SelectContent>
                  {(sizes.data ?? []).map((s:any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField name="location_id" render={({ field }) => (
          <FormItem>
            <FormLabel>Location</FormLabel>
            <FormControl>
              <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={locations.isLoading}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {(locations.data ?? []).map((l:any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField name="trays" render={({ field }) => (
          <FormItem>
            <FormLabel>Trays</FormLabel>
            <FormControl>
              <Input type="number" value={field.value ?? 0} onChange={(e) => field.onChange(e.target.value)} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField name="planted_at" render={({ field }) => (
          <FormItem>
            <FormLabel>Planted Date</FormLabel>
            <FormControl>
              <Input type="date" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="pt-2">
          <Button type="submit">Create Propagation Batch</Button>
        </div>
      </form>
    </Form>
  );
}
