'use client';

import type { Batch } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Sparkles, BookText, Calendar, MapPin, Package } from 'lucide-react';
import { format } from 'date-fns';

interface BatchCardProps {
  batch: Batch;
  onEdit: (batch: Batch) => void;
  onDelete: (id: string) => void;
  onGetRecommendations: (batch: Batch) => void;
}

export function BatchCard({
  batch,
  onEdit,
  onDelete,
  onGetRecommendations,
}: BatchCardProps) {
  const statusColors = {
    Seeding: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
    Growing: 'bg-green-500/20 text-green-700 border-green-500/30',
    'Ready for Sale': 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  };
  
  return (
    <Card className="flex flex-col overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/50">
      <CardHeader>
        <div className="flex items-start justify-between">
            <CardTitle className="font-headline text-2xl">{batch.plantType}</CardTitle>
            <Badge variant="outline" className={cn('whitespace-nowrap', statusColors[batch.status])}>
                {batch.status}
            </Badge>
        </div>
        <CardDescription className="flex items-center gap-2 pt-2">
          <MapPin className="h-4 w-4" /> {batch.location}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span>Quantity: {batch.quantity}</span>
            </div>
            <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Planted: {format(new Date(batch.plantingDate), 'MMM d, yyyy')}</span>
            </div>
        </div>
        
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="log-history">
            <AccordionTrigger>
                <div className="flex items-center gap-2">
                    <BookText className="h-4 w-4" /> Log History
                </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 text-sm text-muted-foreground pl-4">
                {batch.logHistory.length > 0 ? (
                  batch.logHistory.map((log, index) => (
                    <li key={index} className="list-disc list-inside">
                      <strong>{format(new Date(log.date), 'MMM d, yyyy')}:</strong> {log.action}
                    </li>
                  ))
                ) : (
                  <li>No log entries yet.</li>
                )}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
      <CardFooter className="grid grid-cols-3 gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(batch)}>
          <Pencil />
          Edit
        </Button>
        <Button variant="outline" size="sm" onClick={() => onGetRecommendations(batch)} className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
          <Sparkles />
          AI Care
        </Button>
        <Button variant="destructive" size="sm" onClick={() => onDelete(batch.id)}>
          <Trash2 />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}

// Helper to avoid build errors with cn
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
