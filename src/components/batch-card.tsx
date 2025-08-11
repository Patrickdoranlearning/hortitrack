
'use client';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Batch } from '@/lib/types';
import { ImageIcon, MoveRight, ClipboardList } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Button } from './ui/button';

interface BatchCardProps {
  batch: Batch;
  onClick: (batch: Batch) => void;
  onLogAction: (batch: Batch) => void;
  onTransplant: (batch: Batch) => void;
}

export function BatchCard({ batch, onClick, onLogAction, onTransplant }: BatchCardProps) {
  const stockPercentage = batch.initialQuantity > 0 ? (batch.quantity / batch.initialQuantity) * 100 : 0;

  const getStatusVariant = (status: Batch['status']): "default" | "secondary" | "destructive" | "outline" | "accent" | "info" => {
    switch (status) {
      case 'Ready for Sale':
      case 'Looking Good':
        return 'accent';
      case 'Propagation':
      case 'Plugs/Liners':
        return 'info';
      case 'Potted':
        return 'default';
      case 'Archived':
        return 'destructive';
      default:
        return 'outline';
    }
  };
  
  const handleActionClick = (e: React.MouseEvent, action: (batch: Batch) => void) => {
    e.stopPropagation();
    action(batch);
  };
  
  return (
      <Card 
        className="flex flex-col h-full w-full hover:border-primary transition-colors cursor-pointer"
        onClick={() => onClick(batch)}
      >
        <CardHeader className="pb-2">
          <CardTitle className="font-headline text-xl">
            {batch.plantVariety}{' '}
            <span className="text-lg font-normal text-muted-foreground font-body">
              {batch.plantFamily}
            </span>
          </CardTitle>
          <CardDescription>Batch #{batch.batchNumber}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 flex-grow">
          <div className="aspect-video w-full flex items-center justify-center bg-muted rounded-md">
              <ImageIcon className="h-12 w-12 text-muted-foreground" />
          </div>
          <div className="pt-2">
            <div className="flex justify-between text-sm font-semibold mb-1">
              <span>Stock</span>
              <span>{batch.quantity} / {batch.initialQuantity}</span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Progress value={stockPercentage} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{Math.round(stockPercentage)}% remaining</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p>
            <span className="font-semibold">Location:</span> {batch.location}
          </p>
          <p>
            <span className="font-semibold">Size:</span> {batch.size}
          </p>
          <div>
            <span className="font-semibold">Status:</span>{' '}
            <Badge variant={getStatusVariant(batch.status)}>{batch.status}</Badge>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 pt-4">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={(e) => handleActionClick(e, onLogAction)}>
                            <ClipboardList className="h-5 w-5" />
                            <span className="sr-only">Log Action</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Log Action</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={(e) => handleActionClick(e, onTransplant)} disabled={batch.quantity === 0}>
                            <MoveRight className="h-5 w-5" />
                            <span className="sr-only">Transplant</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Transplant</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </CardFooter>
      </Card>
  );
}

    