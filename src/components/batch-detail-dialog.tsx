
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Batch } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Pencil, MoveRight, ClipboardList, FileText, MessageSquare, ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { BatchChatDialog } from '@/components/batch-chat-dialog';

interface BatchDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    batch: Batch | null;
    onEdit: (batch: Batch) => void;
    onTransplant: (batch: Batch) => void;
    onLogAction: (batch: Batch) => void;
    onGenerateProtocol: (batch: Batch) => void;
}

export function BatchDetailDialog({ 
    open, 
    onOpenChange, 
    batch,
    onEdit,
    onTransplant,
    onLogAction,
    onGenerateProtocol,
}: BatchDetailDialogProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);

  if (!batch) return null;

  const handleEdit = () => onEdit(batch);
  const handleTransplant = () => onTransplant(batch);
  const handleLogAction = () => onLogAction(batch);
  const handleGenerateProtocol = () => onGenerateProtocol(batch);

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

  const stockPercentage = batch.initialQuantity > 0 ? (batch.quantity / batch.initialQuantity) * 100 : 0;
  
  const formatDate = (date: any): string => {
    if (!date) return 'N/A';
    // Handle Firestore Timestamps passed from server actions
    if (date.toDate) {
      return format(date.toDate(), 'PPP p');
    }
    // Handle ISO strings from client-side state
    if (typeof date === 'string') {
      try {
        return format(parseISO(date), 'PPP p');
      } catch (e) {
        return date; // fallback to original string if parsing fails
      }
    }
    // Handle native Date objects
    if (date instanceof Date) {
      return format(date, 'PPP p');
    }
    return String(date);
  };


  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
            <DialogHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                    <div className="mb-4 sm:mb-0">
                        <DialogTitle className="font-headline text-3xl">{batch.plantVariety}</DialogTitle>
                        <DialogDescription className="text-lg">{batch.plantFamily} - Batch #{batch.batchNumber}</DialogDescription>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 sm:flex sm:flex-wrap sm:justify-end gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => setIsChatOpen(true)}>
                            <MessageSquare /> AI Chat
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleLogAction}><ClipboardList /> Log</Button>
                        <Button variant="outline" size="sm" onClick={handleTransplant}><MoveRight /> Transplant</Button>
                        <Button variant="outline" size="sm" onClick={handleGenerateProtocol}><FileText /> Protocol</Button>
                        <Button size="sm" onClick={handleEdit}><Pencil /> Edit</Button>
                    </div>
                </div>
            </DialogHeader>
            
            <Tabs defaultValue="summary" className="w-full pt-4">
                <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="history">Log History</TabsTrigger>
                </TabsList>
                <TabsContent value="summary">
                    <Card className="mt-2">
                        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-1 space-y-4">
                                <div className="aspect-square w-full flex items-center justify-center bg-muted rounded-md">
                                    <ImageIcon className="h-16 w-16 text-muted-foreground" />
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
                                    <div className="text-sm font-medium text-muted-foreground">Status</div>
                                    <div><Badge variant={getStatusVariant(batch.status)}>{batch.status}</Badge></div>
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
                <Card className="mt-2">
                    <CardContent className="p-6">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[200px]">Date</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {batch.logHistory.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((log, index) => (
                                    <TableRow key={log.id || index}>
                                        <TableCell>{formatDate(log.date)}</TableCell>
                                        <TableCell>{log.note || log.type}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                </TabsContent>
            </Tabs>
        </DialogContent>
    </Dialog>
    <BatchChatDialog open={isChatOpen} onOpenChange={setIsChatOpen} batch={batch} />
    </>
  );
}
