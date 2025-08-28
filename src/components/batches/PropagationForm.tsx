
'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ComboBoxEntity } from '../horti/ComboBoxEntity';
import { useActiveOrg } from '@/lib/org/context';

const Schema = z.object({
  variety_id: z.string().min(1),
  size_id: z.string().min(1),
  location_id: z.string().min(1),
  trays: z.coerce.number().int().min(0),
  planted_at: z.string().min(1),
});

const VARIETY_SELECT = "id,name,family,genus,species";
const SIZE_SELECT = "id,name,container_type,multiple:cell_multiple";
const LOCATION_SELECT = "id,name";

export default function PropagationForm({ orgId }: { orgId?: string }) {
  const { orgId: activeOrgId } = useActiveOrg();
  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: { variety_id: '', size_id: '', location_id: '', trays: 0, planted_at: new Date().toISOString().slice(0,10) },
  });

  return (
    <Form {...form}>
      <form className="space-y-4">
         <ComboBoxEntity
            table="plant_varieties"
            select={VARIETY_SELECT}
            label="Variety"
            orgScoped={false}
            placeholder="Select variety"
            value={null}
            onSelect={(id) => form.setValue("variety_id", id ?? "")}
        />
        <ComboBoxEntity
            table="plant_sizes"
            select={SIZE_SELECT}
            label="Tray Size"
            orgScoped={false}
            filters={[{ column: "container_type", op: "eq", value: "Tray" }]}
            placeholder="Select tray size"
            value={null}
            onSelect={(id) => form.setValue("size_id", id ?? "")}
        />
        <ComboBoxEntity
            table="nursery_locations"
            select={LOCATION_SELECT}
            label="Location"
            orgScoped={true}
            placeholder="Select location"
            value={null}
            onSelect={(id) => form.setValue("location_id", id ?? "")}
        />

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
