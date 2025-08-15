
'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Batch, NurseryLocation, PlantSize } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Pencil, MoveRight, ClipboardList, FileText, MessageSquare, Trash2, Leaf, Camera, Flag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO, isValid } from 'date-fns';
import { BatchChatDialog } from '@/components/batch-chat-dialog';
import { uploadBatchPhoto } from '@/lib/storage';
import FlagBatchDialog from '@/components/flag-batch-dialog';
import { useToast } from '@/hooks/use-toast';

interface BatchDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    batch: Batch | null;
    onEdit: (batch: Batch) => void;
    onTransplant: (batch: Batch) => void;
    onLogAction: (batch: Batch) => void;
    onGenerateProtocol: (batch: Batch) => void;
    onCareRecommendations: (batch: Batch) => void;
    onDelete?: (batch: Batch) => void;
    nurseryLocations: NurseryLocation[];
    plantSizes: PlantSize[];
}

export function BatchDetailDialog({ 
    open, 
    onOpenChange, 
    batch,
    onEdit,
    onTransplant,
    onLogAction,
    onGenerateProtocol,
    onCareRecommendations,
    onDelete,
    nurseryLocations,
    plantSizes,
}: BatchDetailDialogProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [flagOpen, setFlagOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handlePickPhoto = () => fileInputRef.current?.click();
  const handlePhotoChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !batch?.id) return;
    try {
      const url = await uploadBatchPhoto(batch.id, f);
      await fetch(`/api/batches/${batch.id}/log`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "Photo", photoUrl: url }),
      });
      toast({ title: "Photo uploaded", description: "The photo has been logged for this batch." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload Failed", description: err?.message ?? "Photo upload failed" });
    } finally {
      e.target.value = "";
    }
  };

  if (!batch) return null;

  const handleEdit = () => onEdit(batch);
  const handleTransplant = () => onTransplant(batch);
  const handleLogAction = () => onLogAction(batch);
  const handleGenerateProtocol = () => onGenerateProtocol(batch);
  const handleCareRecommendations = () => onCareRecommendations(batch);
  const handleDelete = () => onDelete?.(batch);

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
  
  const formatDate = (date: any, fmt: string = 'PPP p'): string => {
    if (!date) return '—';
    if (date.toDate) {
      const d = date.toDate();
      return isValid(d) ? format(d, fmt) : '—';
    }
    if (typeof date === 'string') {
        const parsedDate = parseISO(date);
        return isValid(parsedDate) ? format(parsedDate, fmt) : '—';
    }
    if (date instanceof Date) {
      return isValid(date) ? format(date, fmt) : '—';
    }
    try {
        const d = new Date(date);
        return isValid(d) ? format(d, fmt) : '—';
    } catch {
        return '—';
    }
  };

  const dateToMillis = (date: any): number => {
    try {
      if (!date) return 0;
      if (typeof date?.toDate === 'function') return date.toDate().getTime();
      if (typeof date === 'string') {
        const d = parseISO(date);
        return isValid(d) ? d.getTime() : 0;
      }
      if (date instanceof Date) return isValid(date) ? date.getTime() : 0;
      const d = new Date(date);
      return isValid(d) ? d.getTime() : 0;
    } catch { return 0; }
  };


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[100vw] h-[100dvh] max-w-none rounded-none p-0 sm:h-auto sm:max-w-2xl sm:rounded-xl sm:p-6">
          <div className="h-[100dvh] overflow-y-auto sm:h-auto sm:max-h-[80vh]">
            <DialogHeader className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                <div className="mb-4 sm:mb-0">
                  <DialogTitle className="font-headline text-3xl">{batch.plantVariety}</DialogTitle>
                  <DialogDescription className="text-lg">{batch.plantFamily} - Batch #{batch.batchNumber}</DialogDescription>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 sm:flex sm:flex-wrap sm:justify-end gap-2 shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoChosen}
                  />
                  <Button variant="outline" size="sm" onClick={() => setIsChatOpen(true)}><MessageSquare /> AI Chat</Button>
                  <Button variant="outline" size="sm" onClick={handleLogAction}><ClipboardList /> Log</Button>
                  <Button variant="outline" size="sm" onClick={handleTransplant}><MoveRight /> Transplant</Button>
                  <Button variant="outline" size="sm" onClick={() => onGenerateProtocol(batch)}><FileText /> Protocol</Button>
                  <Button variant="outline" size="sm" onClick={() => onCareRecommendations(batch)}><Leaf /> Care Recs</Button>
                   <Button variant="outline" size="sm" onClick={handlePickPhoto}><Camera /> Photo</Button>
                   <Button variant={batch?.flag?.active ? "destructive" : "outline"} size="sm" onClick={() => {
                      if (batch?.flag?.active) {
                        fetch(`/api/batches/${batch!.id}/log`, {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ type: "Unflagged" }),
                        }).catch(() => {});
                      } else {
                        setFlagOpen(true);
                      }
                    }}>
                      <Flag className="mr-1 h-4 w-4" />
                      {batch?.flag?.active ? "Clear Flag" : "Flag"}
                    </Button>
                  <Button size="sm" onClick={handleEdit}><Pencil /> Edit</Button>
                  {onDelete && <Button variant="destructive" size="sm" onClick={handleDelete}><Trash2 /> Delete</Button>}
                </div>
              </div>
            </DialogHeader>

            <div className="px-6 pb-6">
              <Tabs defaultValue="summary" className="w-full">
                <TabsList>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="history">Log History</TabsTrigger>
                  <TabsTrigger value="photos">Photos</TabsTrigger>
                </TabsList>
                <TabsContent value="summary">
                  <Card className="mt-2">
                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-1 space-y-4">
                        
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
                          <p className="font-semibold">
                            {formatDate(batch.plantingDate, 'PPP')}
                          </p>
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
                          {(batch.logHistory ?? [])
                            .slice()
                            .sort((a, b) => dateToMillis(b.at || b.date) - dateToMillis(a.at || a.date))
                            .map((log, index) => (
                              <TableRow key={log.id || index}>
                                <TableCell>{formatDate(log.at || log.date)}</TableCell>
                                <TableCell>{log.note || log.type || log.action}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="photos">
                  <Card className="mt-2">
                    <CardContent className="p-6">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
                          {batch.growerPhotoUrl ? (
                            <img
                              src={batch.growerPhotoUrl}
                              alt="Grower"
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full grid place-items-center text-sm text-muted-foreground">
                              No Grower Photo
                            </div>
                          )}
                        </div>

                        <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
                          {batch.salesPhotoUrl ? (
                            <img
                              src={batch.salesPhotoUrl}
                              alt="Sales"
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full grid place-items-center text-sm text-muted-foreground">
                              No Sales Photo
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <BatchChatDialog
        open={isChatOpen}
        onOpenChange={setIsChatOpen}
        batchId={batch?.id}
        batchNumber={batch?.batchNumber}
      />
      
      <FlagBatchDialog
        open={flagOpen}
        onOpenChange={setFlagOpen}
        batchId={batch!.id}
        onDone={() => {
          toast({ title: "Batch flagged", description: "The issue has been recorded."});
        }}
      />
    </>
  );
}

    