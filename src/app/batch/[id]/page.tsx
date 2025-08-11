
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Batch } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Pencil, MoveRight, ClipboardList, FileText, Archive, MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { BatchChatDialog } from '@/components/batch-chat-dialog';

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);


  useEffect(() => {
    if (!id) return;

    const docRef = doc(db, 'batches', id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setBatch({ ...docSnap.data(), id: docSnap.id } as Batch);
      } else {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Batch not found.'
        });
        router.push('/');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, router, toast]);

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

  if (loading) {
    return <BatchDetailSkeleton />;
  }

  if (!batch) {
    return null; 
  }

  const stockPercentage = batch.initialQuantity > 0 ? (batch.quantity / batch.initialQuantity) * 100 : 0;

  return (
    <div className="container mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
            <Button variant="outline" size="sm" onClick={() => router.push('/')} className="mb-2">
                <ArrowLeft />
                Back to All Batches
            </Button>
            <h1 className="mb-1 font-headline text-4xl">{batch.plantVariety}</h1>
            <p className="text-muted-foreground text-lg">{batch.plantFamily} - Batch #{batch.batchNumber}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
            <Button variant="outline" onClick={() => setIsChatOpen(true)}>
                <MessageSquare />
                AI Chat
            </Button>
            {/* These buttons would need their corresponding dialogs/actions wired up from the main page */}
            {/* <Button variant="outline"><ClipboardList /> Log Action</Button>
            <Button variant="outline"><MoveRight /> Transplant</Button>
            <Button variant="outline"><FileText /> Gen. Protocol</Button>
            <Button><Pencil /> Edit Batch</Button> */}
        </div>
      </div>
      
      <Tabs defaultValue="summary" className="w-full">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="history">Log History</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
            <Card>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 space-y-4">
                        <div className="aspect-square w-full flex items-center justify-center bg-muted rounded-md">
                            <p className="text-muted-foreground">Image</p>
                        </div>
                         <div className="space-y-2">
                            <div className="flex justify-between text-sm font-semibold">
                                <span>Stock</span>
                                <span>{batch.quantity.toLocaleString()} / {batch.initialQuantity.toLocaleString()}</span>
                            </div>
                            <Progress value={stockPercentage} aria-label={`${Math.round(stockPercentage)}% remaining`} />
                         </div>
                    </div>
                    <div className="md:col-span-2 grid grid-cols-2 gap-x-8 gap-y-4">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Status</p>
                            <p><Badge variant={getStatusVariant(batch.status)}>{batch.status}</Badge></p>
                        </div>
                         <div>
                            <p className="text-sm font-medium text-muted-foreground">Location</p>
                            <p className="font-semibold">{batch.location}</p>
                        </div>
                         <div>
                            <p className="text-sm font-medium text-muted-foreground">Size</p>
                            <p className="font-semibold">{batch.size}</p>
                        </div>
                         <div>
                            <p className="text-sm font-medium text-muted-foreground">Supplier</p>
                            <p className="font-semibold">{batch.supplier || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Planting Date</p>
                            <p className="font-semibold">{format(new Date(batch.plantingDate), 'PPP')}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Category</p>
                            <p className="font-semibold">{batch.category}</p>
                        </div>
                         {batch.transplantedFrom && (
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Transplanted From</p>
                                <p className="font-semibold">#{batch.transplantedFrom}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card>
            <CardHeader>
                <CardTitle>Log History</CardTitle>
                <CardDescription>A complete record of all actions and events for this batch.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px]">Date</TableHead>
                            <TableHead>Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {batch.logHistory.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((log, index) => (
                            <TableRow key={index}>
                                <TableCell>{format(new Date(log.date), 'PPP p')}</TableCell>
                                <TableCell>{log.action}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <BatchChatDialog open={isChatOpen} onOpenChange={setIsChatOpen} batch={batch} />
    </div>
  );
}


function BatchDetailSkeleton() {
    return (
      <div className="container mx-auto max-w-5xl p-4 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-10 w-80 mb-1" />
            <Skeleton className="h-5 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        
        <Tabs defaultValue="summary" className="w-full">
          <TabsList>
             <Skeleton className="h-10 w-24" />
             <Skeleton className="h-10 w-24" />
          </TabsList>
          <TabsContent value="summary">
              <Card>
                  <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-1 space-y-4">
                          <Skeleton className="aspect-square w-full" />
                          <Skeleton className="h-4 w-full" />
                      </div>
                      <div className="md:col-span-2 grid grid-cols-2 gap-8">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                  </CardContent>
              </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

    