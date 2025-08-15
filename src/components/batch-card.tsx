
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
import { ImageIcon, ClipboardList, Flag } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Button } from './ui/button';
import { TransplantIcon } from './icons';

interface BatchCardProps {
  batch: Batch;
  onClick: (batch: Batch) => void;
  onLogAction: (batch: Batch) => void;
  onTransplant: (batch: Batch) => void;
}

export function BatchCard({
  batch,
  onClick,
  onLogAction,
  onTransplant,
}: BatchCardProps) {
  const stockPercentage =
    batch.initialQuantity > 0
      ? (batch.quantity / batch.initialQuantity) * 100
      : 0;

  const getStatusVariant = (
    status: Batch['status']
  ): 'default' | 'secondary' | 'destructive' | 'outline' | 'accent' | 'info' => {
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

  const handleActionClick = (
    e: React.MouseEvent,
    action: (batch: Batch) => void
  ) => {
    e.stopPropagation();
    action(batch);
  };

  return (
    <Card
      className="flex flex-col h-full w-full hover:border-primary transition-colors cursor-pointer"
      onClick={() => onClick(batch)}
    >
      <CardContent className="p-3 flex gap-3 items-start flex-grow">
        <div className="aspect-square w-20 flex-shrink-0 flex items-center justify-center bg-muted rounded-md">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="flex-grow space-y-2">
          <div>
            <CardTitle className="font-headline text-lg leading-tight flex items-center gap-2">
              {batch.plantVariety}
              {batch.flag?.active && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                       <Flag className="h-4 w-4 text-destructive" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Flagged: {batch.flag.reason}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {batch.plantFamily}
            </CardDescription>
            <CardDescription className="text-xs pt-1">
              Batch #{batch.batchNumber}
            </CardDescription>
          </div>
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span>Stock</span>
              <span>
                {batch.quantity} / {batch.initialQuantity}
              </span>
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
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center p-3 pt-0">
        <Badge variant={getStatusVariant(batch.status)}>{batch.status}</Badge>
        <div className="flex gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleActionClick(e, onLogAction)}
                >
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleActionClick(e, onTransplant)}
                  disabled={batch.quantity === 0}
                >
                  <TransplantIcon />
                  <span className="sr-only">Transplant</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Transplant</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardFooter>
    </Card>
  );
}
