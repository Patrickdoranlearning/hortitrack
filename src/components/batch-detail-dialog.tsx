
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
import { Pencil, MoveRight, ClipboardList, FileText, MessageSquare, Trash2, Leaf, Camera, Flag, QrCode, Printer, FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO, isValid } from 'date-fns';
import { BatchChatDialog } from '@/components/batch-chat-dialog';
import { uploadBatchPhoto } from '@/lib/storage';
import FlagBatchDialog from '@/components/flag-batch-dialog';
import { useToast } from '@/hooks/use-toast';
import { FeatureGate } from './FeatureGate';
import { BatchActionBar } from './batches/BatchActionBar';
import BatchLabelPreview from './BatchLabelPreview';
import { useGenerateProtocol } from '@/hooks/useGenerateProtocol';


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
}: BatchDetailDialogProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [flagOpen, setFlagOpen] = React.useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [photos, setPhotos] = React.useState<Array<{id:string; url:string}>>([]);
  const { generate } = useGenerateProtocol();
  const [genBusy, setGenBusy] = React.useState(false);
  
  const refreshPhotos = async () => {
    if (!batch?.id) return;
    const r = await fetch(`/api/batches/${batch.id}/photos`);
    const j = await r.json();
    if (Array.isArray(j.photos)) setPhotos(j.photos);
  };
  
  React.useEffect(() => { 
    if (batch?.id) {
        refreshPhotos();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch?.id]);

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
      refreshPhotos(); // Refresh photos after upload
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
  
  async function handleGenerateProtocolClick() {
    if (!batch) return;
    // Always enabled: if not top-performer, ask before proceeding
    if (!batch.isTopPerformer) {
      const proceed = typeof window !== "undefined"
        ? window.confirm("This batch is not marked Top performer. Generate a protocol anyway?")
        : true;
      if (!proceed) return;
    }
    setGenBusy(true);
    try {
      const name = `Protocol – ${batch.plantVariety || "Batch"} (${new Date().toISOString().slice(0, 10)})`;
      const protocol = await generate(batch.id!, { publish: true, name });
      
      toast?.({ title: "Protocol created", description: protocol.name });
      console.log("Protocol created", protocol);
      
    } catch (e: any) {
      toast?.({ title: "Generate failed", description: e.message, variant: "destructive" });
      console.error("Generate protocol failed", e);
    } finally {
      setGenBusy(false);
    }
  }

  const handleCareRecommendations = () => onCareRecommendations(batch);
  const handleDelete = () => onDelete?.(batch);
  const handlePrint = () => setIsPreviewOpen(true);


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
        <DialogContent
          className="min-w-0 overflow-x-hidden"
          style={{
            width: "calc(100vw - 2rem)",
            maxWidth: "min(100vw - 2rem, 1180px)",
          }}
        >
          <div className="h-[100dvh] overflow-y-auto sm:h-auto sm:max-h-[80vh]">
            <DialogHeader className="p-6">
                <DialogTitle>Batch Actions</DialogTitle>
            </DialogHeader>

            <div className="px-6 pb-6">
              <BatchActionBar
                  batch={{ id: batch.id!, batchNumber: batch.batchNumber, status: batch.status }}
                  onEdit={handleEdit}
                  onMove={handleTransplant}
                  onPrint={handlePrint}
                  onDelete={onDelete ? handleDelete : undefined}
                  onActionLog={handleLogAction}
                  onGenerateProtocol={handleGenerateProtocolClick}
                  onArchive={batch.status !== 'Archived' ? () => { console.log('archive'); } : undefined}
                  onUnarchive={batch.status === 'Archived' ? () => { console.log('unarchive'); } : undefined}
                  onPhotoAdded={refreshPhotos}
              />
              
              {genBusy && (
                <div className="mt-2 text-xs text-muted-foreground">Generating protocol…</div>
              )}

              <section className="mt-4 space-y-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-muted-foreground">Batch</span>
                  <span className="font-semibold whitespace-nowrap">{batch.batchNumber}</span>
                  <span className="text-muted-foreground select-none">•</span>
                  <span className="font-medium truncate min-w-0 flex-1" title={String(batch.plantVariety ?? "")}>
                    {batch.plantVariety}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {batch.plantFamily && <span>Family: <b className="text-foreground">{batch.plantFamily}</b></span>}
                  {batch.size && <span>Size: <b className="text-foreground">{batch.size}</b></span>}
                  {batch.location && <span>Location: <b className="text-foreground">{batch.location}</b></span>}
                  {batch.status && <span>Status: <b className="text-foreground">{batch.status}</b></span>}
                </div>
              </section>

              {!!photos.length && (
                <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {photos.map((p) => (
                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer"
                       className="block aspect-square overflow-hidden rounded-md border bg-muted/30">
                      <img src={p.url} alt="Batch photo" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}

              <Tabs defaultValue="summary" className="w-full mt-4">
                <TabsList>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="history">Log History</TabsTrigger>
                  <TabsTrigger value="photos">Photos</TabsTrigger>
                  <TabsTrigger value="ai">AI Tools</TabsTrigger>
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
                       <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handlePhotoChosen}
                      />
                      <Button variant="outline" size="sm" onClick={handlePickPhoto}><Camera /> Add Photo</Button>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mt-4">
                         {photos.map((p) => (
                          <a key={p.id} href={p.url} target="_blank" rel="noreferrer"
                             className="block aspect-square overflow-hidden rounded-md border bg-muted/30">
                            <img src={p.url} alt="Batch photo" className="h-full w-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                 <TabsContent value="ai">
                  <Card className="mt-2">
                    <CardContent className="p-6 space-y-4">
                       <div className="space-y-2">
                         <h3 className="font-semibold">AI Tools</h3>
                         <p className="text-sm text-muted-foreground">
                           Use AI to get insights and automate tasks for this batch.
                         </p>
                       </div>
                       <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" onClick={() => setIsChatOpen(true)}>
                              <MessageSquare /> AI Chat
                          </Button>
                           <Button variant="outline" onClick={() => onGenerateProtocol(batch)}>
                               <FileText /> Generate Protocol
                           </Button>
                           <FeatureGate name="aiCare">
                              <Button variant="outline" onClick={handleCareRecommendations}>
                                  <Leaf /> Care Recommendations
                              </Button>
                           </FeatureGate>
                           <Button variant={batch?.flag?.active ? "destructive" : "outline"} onClick={() => {
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
                                {batch?.flag?.active ? "Clear Flag" : "Flag Batch"}
                            </Button>
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
        batch={batch}
        onDone={() => {
          toast({ title: "Batch flagged", description: "The issue has been recorded."});
        }}
      />
       <BatchLabelPreview
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        batch={{
          id: batch.id!,
          batchNumber: batch.batchNumber,
          plantVariety: batch.plantVariety,
          plantFamily: batch.plantFamily,
          size: batch.size,
          quantity: batch.quantity,
          initialQuantity: batch.initialQuantity,
        }}
      />
    </>
  );
}
