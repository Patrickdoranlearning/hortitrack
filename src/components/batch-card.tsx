
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
import { Pencil, MoveRight, ClipboardList, FileText, Image as ImageIcon } from 'lucide-react';
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
  onTransplant: (batch: Batch) => void;
  onLogAction: (batch: Batch) => void;
  onGenerateProtocol: (batch: Batch) => void;
}

export function BatchCard({ batch, onEdit, onTransplant, onLogAction, onGenerateProtocol }: BatchCardProps) {
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
  
  return (
    <Card className="flex flex-col h-full">
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
                    <Button variant="outline" size="icon" onClick={() => onTransplant(batch)} disabled={batch.quantity === 0 || batch.status === 'Archived'}>
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
        </TooltipProvider>
      </CardFooter>
    </Card>
  );
}
