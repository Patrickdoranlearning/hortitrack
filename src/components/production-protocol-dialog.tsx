
'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { getProductionProtocolAction } from '@/app/actions';
import type { ProductionProtocolOutput } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileText, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';

interface ProductionProtocolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string | null | undefined;
}

export function ProductionProtocolDialog({
  open,
  onOpenChange,
  batchId,
}: ProductionProtocolDialogProps) {
  const [loading, setLoading] = useState(false);
  const [protocol, setProtocol] =
    useState<ProductionProtocolOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open && batchId) {
      setLoading(true);
      setError(null);
      setProtocol(null);

      const fetchProtocol = async () => {
        const result = await getProductionProtocolAction(batchId);
        if (result.success) {
          setProtocol(result.data);
        } else {
          setError(result.error);
          toast.error(result.error);
        }
        setLoading(false);
      };

      fetchProtocol();
    }
  }, [open, batchId]);

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
        setProtocol(null);
        setError(null);
        setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-headline text-2xl">
            <FileText className="text-primary" />
            Production Protocol
          </DialogTitle>
          <DialogDescription>
            A generated guide based on the history of a successful batch.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-6">
            <div className="py-4">
            {loading && <ProtocolSkeleton />}
            {error && <ErrorAlert message={error} />}
            {protocol && <ProtocolDisplay protocol={protocol} />}
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ProtocolSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="space-y-3 pt-4">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
       <div className="space-y-3 pt-4">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
      </div>
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function ProtocolDisplay({ protocol }: { protocol: ProductionProtocolOutput }) {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="font-headline text-xl text-primary">{protocol.protocolTitle}</h3>
                <p className="text-muted-foreground mt-1">{protocol.summary}</p>
            </div>

            <div>
                <h4 className="font-semibold text-lg mb-3">Production Timeline</h4>
                <div className="relative pl-6 space-y-6 border-l-2 border-primary/20">
                    {protocol.timeline.map((item, index) => (
                        <div key={`${item.date}-${item.action}-${index}`} className="relative">
                            <div className="absolute -left-[34px] top-1 flex items-center justify-center w-4 h-4 bg-primary rounded-full">
                                <Clock className="h-2 w-2 text-primary-foreground" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <h5 className="font-semibold">Day {item.day}</h5>
                                <Badge variant="secondary">{item.action}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{item.details}</p>
                        </div>
                    ))}
                </div>
            </div>
            
            <div>
                <h4 className="font-semibold text-lg mb-2">Key Recommendations</h4>
                <ul className="space-y-3">
                    {protocol.recommendations.map((rec, index) => (
                        <li key={`${rec.slice(0, 10)}-${index}`} className="flex items-start gap-3">
                            <CheckCircle className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                            <span>{rec}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}
