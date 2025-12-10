"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tag, Link2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  addProductBatchAction,
  removeProductBatchAction,
} from "./actions";
import type { BatchMapping, ProductSummary } from "./types";

type Props = {
  batches: BatchMapping[];
  products: ProductSummary[];
};

export default function ProductBatchMappingClient({ batches, products }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isAutoAllPending, startAutoAll] = useTransition();

  const filteredBatches = useMemo(() => {
    if (!filter.trim()) return batches;
    const query = filter.toLowerCase();
    return batches.filter((batch) => {
      return (
        batch.batchNumber.toLowerCase().includes(query) ||
        (batch.varietyName ?? "").toLowerCase().includes(query) ||
        (batch.sizeName ?? "").toLowerCase().includes(query)
      );
    });
  }, [filter, batches]);

  const handleLink = async (batchId: string) => {
    const productId = selectedProduct[batchId];
    if (!productId) {
      toast({ variant: "destructive", title: "Select a product first" });
      return;
    }
    setPendingId(batchId);
    const result = await addProductBatchAction({ productId, batchId });
    if (!result.success) {
      toast({ variant: "destructive", title: "Failed to link batch", description: result.error });
    } else {
      toast({ title: "Batch linked" });
      router.refresh();
    }
    setPendingId(null);
  };

  const handleAutoLink = async (batch: BatchMapping) => {
    const match = findBestProductMatch(batch, products);
    if (!match) {
      toast({ variant: "destructive", title: "No match found", description: "No product shares this variety & size." });
      return;
    }
    if (batch.linkedProducts.some((entry) => entry.productId === match.id)) {
      toast({ title: "Already linked", description: `${match.name} already includes this batch.` });
      return;
    }
    setPendingId(batch.id);
    const result = await addProductBatchAction({ productId: match.id, batchId: batch.id });
    if (!result.success) {
      toast({ variant: "destructive", title: "Auto-link failed", description: result.error });
    } else {
      toast({ title: "Batch linked", description: `Mapped to ${match.name}` });
      router.refresh();
    }
    setPendingId(null);
  };

  const handleAutoAll = () => {
    startAutoAll(async () => {
      let updated = 0;
      for (const batch of batches) {
        const match = findBestProductMatch(batch, products);
        if (!match) continue;
        if (batch.linkedProducts.some((entry) => entry.productId === match.id)) continue;
        const result = await addProductBatchAction({ productId: match.id, batchId: batch.id });
        if (result.success) {
          updated += 1;
        }
      }
      if (updated) {
        toast({ title: `Auto-linked ${updated} batch${updated === 1 ? "" : "es"}` });
        router.refresh();
      } else {
        toast({ title: "No auto-links applied", description: "No eligible batches found." });
      }
    });
  };

  const handleRemove = async (productBatchId: string) => {
    setPendingId(productBatchId);
    const result = await removeProductBatchAction(productBatchId);
    if (!result.success) {
      toast({ variant: "destructive", title: "Failed to remove link", description: result.error });
    } else {
      toast({ title: "Batch link removed" });
      router.refresh();
    }
    setPendingId(null);
  };

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-muted-foreground" />
          Batch → Product mappings
        </CardTitle>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            Link finished batches to products so sales always see available stock.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleAutoAll} disabled={isAutoAllPending}>
              <Sparkles className="mr-2 h-4 w-4" />
              Auto-link ready batches
            </Button>
            <Input
              placeholder="Search batches…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Linked products</TableHead>
              <TableHead className="min-w-[240px]">Assign product</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBatches.map((batch) => (
              <TableRow key={batch.id}>
                <TableCell>
                  <div className="font-medium">#{batch.batchNumber}</div>
                  <div className="text-sm text-muted-foreground">
                    {batch.varietyName ?? "Variety"} • {batch.sizeName ?? "Size"}
                  </div>
                  <div className="text-xs text-muted-foreground">{batch.quantity} units</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{batch.status}</Badge>
                </TableCell>
                <TableCell>
                  {batch.linkedProducts.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Not linked</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {batch.linkedProducts.map((link) => (
                        <Badge key={link.productBatchId} variant="secondary" className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {link.productName}
                          <button
                            type="button"
                            className="ml-1 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemove(link.productBatchId)}
                            disabled={pendingId === link.productBatchId}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-2">
                    <Select
                      value={selectedProduct[batch.id] ?? ""}
                      onValueChange={(value) =>
                        setSelectedProduct((prev) => ({
                          ...prev,
                          [batch.id]: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose product" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleLink(batch.id)}
                        disabled={pendingId === batch.id}
                      >
                        Link
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAutoLink(batch)}
                        disabled={pendingId === batch.id}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        Auto
                      </Button>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function findBestProductMatch(batch: BatchMapping, products: ProductSummary[]): ProductSummary | null {
  if (batch.plantVarietyId && batch.sizeId) {
    const exact = products.find(
      (product) =>
        product.skuVarietyId === batch.plantVarietyId && product.skuSizeId === batch.sizeId
    );
    if (exact) return exact;
  }
  const byName = products.find(
    (product) =>
      product.sku?.label.toLowerCase().includes((batch.varietyName ?? "").toLowerCase()) &&
      product.sku?.label.toLowerCase().includes((batch.sizeName ?? "").toLowerCase())
  );
  return byName ?? null;
}



