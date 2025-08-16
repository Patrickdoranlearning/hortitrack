
'use client';
import * as React from 'react';
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
import { ImageIcon, ClipboardList, Flag, Printer, Ruler, Package, MapPin } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Button } from './ui/button';
import { TransplantIcon } from './icons';
import BatchLabelPreview from './BatchLabelPreview';


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
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

  const stockPercentage =
    batch.initialQuantity > 0
      ? (batch.quantity / batch.initialQuantity) * 100
      : 0;
  
  const variety = batch.plantVariety ?? "Unknown variety";
  const sizeLabel = batch.size != null && String(batch.size).trim().length
    ? String(batch.size)
    : null;

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
  
  const handlePrintClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPreviewOpen(true);
  }

  return (
    <>
      <Card
        className="flex flex-col h-full w-full hover:border-primary transition-colors cursor-pointer group"
        onClick={() => onClick(batch)}
        data-testid="batch-card"
      >
        <CardHeader className="p-3 pb-2">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-grow min-w-0">
                     <CardTitle className="font-headline text-lg leading-tight flex items-center gap-2">
                        <span className="truncate" title={variety}>
                            {variety}
                        </span>
                        {batch.flag?.active && (
                        <TooltipProvider>
                            <Tooltip>
                            <TooltipTrigger>
                                <Flag className="h-4 w-4 text-destructive shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Flagged: {batch.flag.reason}</p>
                            </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        )}
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                        Batch #{batch.batchNumber}
                    </CardDescription>
                </div>
                <div className="shrink-0">
                    <Badge variant={getStatusVariant(batch.status)}>{batch.status}</Badge>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 flex-grow space-y-3">
          <div className="flex justify-between text-xs font-semibold">
                <span>Stock</span>
                <span>
                  {batch.quantity.toLocaleString()} / {batch.initialQuantity.toLocaleString()}
                </span>
              </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-full">
                    <Progress value={stockPercentage} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{Math.round(stockPercentage)}% remaining</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
           {batch.location && (
             <span className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-1">
               <MapPin className="h-3.5 w-3.5" />
               <span className="truncate max-w-[8rem]" title={batch.location}>{batch.location}</span>
             </span>
           )}
           {batch.plantFamily && (
             <span className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-1">
               <Package className="h-3.5 w-3.5" />
               <span className="truncate max-w-[8rem]" title={batch.plantFamily}>{batch.plantFamily}</span>
             </span>
           )}
          {sizeLabel && (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-1"
              title={`Size ${sizeLabel}`}
              aria-label={`Size ${sizeLabel}`}
              data-testid="batch-size"
            >
              <Ruler className="h-3.5 w-3.5" />
              <span className="truncate max-w-[8rem]">{sizeLabel}</span>
            </span>
          )}
         </div>

        </CardContent>
        <CardFooter className="flex justify-end p-2 pt-0">
          <div className="flex gap-1">
            <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handlePrintClick}
                    >
                      <Printer className="h-5 w-5" />
                      <span className="sr-only">Print Label</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Print Label</p>
                  </TooltipContent>
                </Tooltip>
            </TooltipProvider>
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

      <BatchLabelPreview
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        batch={{
          id: batch.id!,
          batchNumber: batch.batchNumber,
          plantVariety: batch.plantVariety,
          plantFamily: batch.plantFamily,
          size: batch.size,
          initialQuantity: batch.initialQuantity ?? batch.quantity ?? 0,
          quantity: batch.quantity,
        }}
      />
    </>
  );
}

