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
import { Pencil, Trash2, Sparkles, MoveRight, ClipboardList, Factory, FileText } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';


interface BatchCardProps {
  batch: Batch;
  onEdit: (batch: Batch) => void;
  onDelete: (batchId: string) => void;
  onGetRecommendations: (batch: Batch) => void;
  onTransplant: (batch: Batch) => void;
  onLogAction: (batch: Batch) => void;
  onGenerateProtocol: (batch: Batch) => void;
}

export function BatchCard({ batch, onEdit, onDelete, onGetRecommendations, onTransplant, onLogAction, onGenerateProtocol }: BatchCardProps) {
  const stockPercentage = (batch.quantity / batch.initialQuantity) * 100;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-xl">
          {batch.plantFamily}
        </CardTitle>
        <CardDescription>{batch.plantVariety} | Batch #{batch.batchNumber}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
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
          <span className="font-semibold">Planting Date:</span>{' '}
          {new Date(batch.plantingDate).toISOString().split('T')[0]}
        </p>
        <p>
          <span className="font-semibold">Location:</span> {batch.location}
        </p>
        <p>
          <span className="font-semibold">Size:</span> {batch.size}
        </p>
        {batch.supplier && (
          <p className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Supplier:</span> {batch.supplier}
          </p>
        )}
        <div>
          <span className="font-semibold">Status:</span>{' '}
          <Badge>{batch.status}</Badge>
        </div>
        {batch.transplantedFrom && (
            <p className="text-sm text-muted-foreground">
                Transplanted from #{batch.transplantedFrom}
            </p>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => onLogAction(batch)}>
                        <ClipboardList className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Log Action</p>
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => onGetRecommendations(batch)}>
                        <Sparkles className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Get AI Recommendations</p>
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => onGenerateProtocol(batch)}>
                        <FileText className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Generate Protocol</p>
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => onTransplant(batch)} disabled={batch.quantity === 0}>
                        <MoveRight className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{batch.quantity > 0 ? 'Transplant Batch' : 'Out of stock'}</p>
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => onEdit(batch)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Edit Batch</p>
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="destructive" size="icon" onClick={() => onDelete(batch.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Delete Batch</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
      </CardFooter>
    </Card>
  );
}
