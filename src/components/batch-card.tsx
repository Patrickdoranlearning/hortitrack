import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Batch } from '@/lib/types';
import { Pencil, Trash2 } from 'lucide-react';

interface BatchCardProps {
  batch: Batch;
  onEdit: (batch: Batch) => void;
  onDelete: (batchId: string) => void;
}

export function BatchCard({ batch, onEdit, onDelete }: BatchCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-xl">
          {batch.plantType}
        </CardTitle>
        <CardDescription>Batch #{batch.batchNumber}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <p>
          <span className="font-semibold">Quantity:</span> {batch.quantity}
        </p>
        <p>
          <span className="font-semibold">Planting Date:</span>{' '}
          {new Date(batch.plantingDate).toLocaleDateString()}
        </p>
        <p>
          <span className="font-semibold">Location:</span> {batch.location}
        </p>
        <div>
          <span className="font-semibold">Status:</span>{' '}
          <Badge>{batch.status}</Badge>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" size="icon" onClick={() => onEdit(batch)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="destructive"
          size="icon"
          onClick={() => onDelete(batch.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
