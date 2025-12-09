"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Settings2, Trash2, Loader2, Tag, Link as LinkIcon, Sparkles, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  addProductBatchAction,
  autoLinkProductBatchesAction,
  deletePriceListCustomerAction,
  deleteProductAction,
  deleteProductPriceAction,
  removeProductBatchAction,
  setCustomerDefaultPriceListAction,
  upsertPriceListCustomerAction,
  upsertProductAction,
  upsertProductPriceAction,
  upsertProductAliasAction,
  deleteProductAliasAction,
} from "./actions";
import type { ProductManagementPayload, ProductSummary, ProductSkuOption } from "./types";
import dynamic from "next/dynamic";

// Lazy load gallery to avoid slowing down initial page load
const ProductGallerySection = dynamic(
  () => import("@/components/products/ProductGallerySection"),
  { 
    loading: () => <div className="p-4 text-center text-muted-foreground">Loading gallery...</div>,
    ssr: false 
  }
);

export default function ProductManagementClient(props: ProductManagementPayload) {
  const { toast } = useToast();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(props.products[0]?.id ?? null);

  const selectedProduct =
    sheetMode === "edit" && selectedProductId ? props.products.find((prod) => prod.id === selectedProductId) ?? null : null;

  const handleManageProduct = (productId: string) => {
    router.push(`/sales/products/${productId}`);
  };

  const handleProductSaved = (productId: string | null) => {
    if (productId) {
      setSelectedProductId(productId);
      setSheetMode("edit");
    }
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Products catalog</CardTitle>
          <CardDescription>Link finished stock to customer-facing products with pricing.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {props.products.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>No products yet. Click "New Product" above to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Inventory</TableHead>
                  <TableHead>Price lists</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.products.map((product) => {
                  // Calculate available vs pipeline quantities
                  const availableBatches = product.batches.filter(b => b.batch?.behavior === "available");
                  const pipelineBatches = product.batches.filter(b => b.batch?.behavior !== "available");
                  const availableQty = availableBatches.reduce((sum, b) => sum + (b.batch?.quantity ?? 0), 0);
                  const pipelineQty = pipelineBatches.reduce((sum, b) => sum + (b.batch?.quantity ?? 0), 0);
                  const varietyNames = Array.from(
                    new Set(
                      product.batches
                        .map((b) => b.batch?.varietyName)
                        .filter((v): v is string => Boolean(v))
                    )
                  );
                  
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.sku?.code ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={product.isActive ? "default" : "outline"}>
                          {product.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-green-700">{availableQty} available</span>
                          {pipelineQty > 0 && (
                            <span className="text-xs text-muted-foreground">{pipelineQty} coming</span>
                          )}
                          {varietyNames.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Varieties: {varietyNames.slice(0, 3).join(", ")}
                              {varietyNames.length > 3 && ` +${varietyNames.length - 3} more`}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{product.prices.length}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleManageProduct(product.id)}>
                          <Settings2 className="mr-2 h-4 w-4" />
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PriceListAssignmentsCard
        priceLists={props.priceLists}
        customers={props.customers}
        assignments={props.priceListCustomers}
      />

      <ProductComposerSheet
        open={sheetOpen}
        mode={sheetMode}
        onOpenChange={setSheetOpen}
        product={selectedProduct}
        skus={props.skus}
        batches={props.batches}
        priceLists={props.priceLists}
        customers={props.customers}
        onProductSaved={handleProductSaved}
      />
    </div>
  );
}

type ComposerProps = {
  open: boolean;
  mode: "create" | "edit";
  onOpenChange: (open: boolean) => void;
  product: ProductSummary | null;
  skus: ProductManagementPayload["skus"];
  batches: ProductManagementPayload["batches"];
  priceLists: ProductManagementPayload["priceLists"];
  customers: ProductManagementPayload["customers"];
  onProductSaved: (productId: string | null) => void;
};

function ProductComposerSheet({ open, onOpenChange, mode, product, skus, batches, priceLists, customers, onProductSaved }: ComposerProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"details" | "inventory" | "pricing">("details");
  const [currentProductId, setCurrentProductId] = useState<string | null>(product?.id ?? null);
  const [isDeleting, startDeleting] = useTransition();

  useEffect(() => {
    setCurrentProductId(product?.id ?? null);
    setActiveTab("details");
  }, [product?.id, mode]);

  const handleDelete = () => {
    if (!product?.id) return;
    startDeleting(async () => {
      const result = await deleteProductAction(product.id);
      if (!result.success) {
        toast({ variant: "destructive", title: "Delete failed", description: result.error ?? "Unable to delete product." });
        return;
      }
      toast({ title: "Product deleted" });
      onProductSaved(null);
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{mode === "edit" ? `Manage ${product?.name ?? "product"}` : "Create product"}</SheetTitle>
        </SheetHeader>
        <Tabs value={activeTab} onValueChange={(next) => setActiveTab(next as typeof activeTab)}>
          <TabsList className="grid grid-cols-5">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="inventory" disabled={!currentProductId}>
              Inventory
            </TabsTrigger>
            <TabsTrigger value="pricing" disabled={!currentProductId}>
              Pricing
            </TabsTrigger>
            <TabsTrigger value="aliases" disabled={!currentProductId}>
              Aliases
            </TabsTrigger>
            <TabsTrigger value="gallery" disabled={!currentProductId}>
              <ImageIcon className="h-4 w-4 mr-1.5" />
              Gallery
            </TabsTrigger>
          </TabsList>
          <TabsContent value="details">
            <ProductDetailsSection
              product={product}
              skus={skus}
              mode={mode}
              onSaved={(id) => {
                setCurrentProductId(id);
                onProductSaved(id);
                setActiveTab("inventory");
              }}
            />
            {mode === "edit" && product?.id ? (
              <div className="mt-6 flex justify-end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isDeleting}>
                      {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Delete product
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this product?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the product and its linked pricing (batches remain untouched).
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : null}
          </TabsContent>
          <TabsContent value="inventory">
            {currentProductId ? (
              <ProductInventorySection
                productId={currentProductId}
                linkedBatches={product?.batches ?? []}
                availableBatches={batches}
              />
            ) : (
              <EmptyTabState label="Save product details first to link batches." />
            )}
          </TabsContent>
          <TabsContent value="pricing">
            {currentProductId ? (
              <ProductPricingSection
                productId={currentProductId}
                priceLists={priceLists}
                prices={product?.prices ?? []}
              />
            ) : (
              <EmptyTabState label="Save product details first to add pricing." />
            )}
          </TabsContent>
          <TabsContent value="aliases">
            {currentProductId ? (
              <ProductAliasesSection
                productId={currentProductId}
                aliases={product?.aliases ?? []}
                customers={customers}
                priceLists={priceLists}
              />
            ) : (
              <EmptyTabState label="Save product details first to manage aliases." />
            )}
          </TabsContent>
          <TabsContent value="gallery">
            {currentProductId ? (
              <ProductGallerySection productId={currentProductId} />
            ) : (
              <EmptyTabState label="Save product details first to add gallery photos." />
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function EmptyTabState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

type ProductDetailsSectionProps = {
  product: ProductSummary | null;
  skus: ProductManagementPayload["skus"];
  mode: "create" | "edit";
  onSaved: (productId: string | null) => void;
  onCreateSku?: () => void;
  forcedSkuId?: string | null;
  onForcedSkuApplied?: () => void;
};

export function ProductDetailsSection({
  product,
  skus,
  mode,
  onSaved,
  onCreateSku,
  forcedSkuId,
  onForcedSkuApplied,
}: ProductDetailsSectionProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formState, setFormState] = useState(() => ({
    name: product?.name ?? "",
    skuId: product?.skuId ?? (skus[0]?.id ?? ""),
    description: product?.description ?? "",
    heroImageUrl: product?.heroImageUrl ?? "",
    defaultStatus: product?.defaultStatus ?? "",
    isActive: product?.isActive ?? true,
  }));

  useEffect(() => {
    setFormState({
      name: product?.name ?? "",
      skuId: product?.skuId ?? (skus[0]?.id ?? ""),
      description: product?.description ?? "",
      heroImageUrl: product?.heroImageUrl ?? "",
      defaultStatus: product?.defaultStatus ?? "",
      isActive: product?.isActive ?? true,
    });
  }, [product?.id]);

  useEffect(() => {
    if (!formState.skuId && skus.length > 0) {
      setFormState((prev) => ({ ...prev, skuId: skus[0].id }));
    }
  }, [skus, formState.skuId]);

  useEffect(() => {
    if (forcedSkuId) {
      setFormState((prev) => ({ ...prev, skuId: forcedSkuId }));
      onForcedSkuApplied?.();
    }
  }, [forcedSkuId, onForcedSkuApplied]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.name.trim() || !formState.skuId) {
      toast({ variant: "destructive", title: "Missing fields", description: "Name and SKU are required." });
      return;
    }
    startTransition(async () => {
      const result = await upsertProductAction({
        id: product?.id,
        name: formState.name.trim(),
        skuId: formState.skuId,
        description: formState.description,
        heroImageUrl: formState.heroImageUrl,
        defaultStatus: formState.defaultStatus,
        isActive: formState.isActive,
      });
      if (!result.success) {
        toast({ variant: "destructive", title: "Save failed", description: result.error ?? "Unable to save product." });
        return;
      }
      const savedId = result.data?.id ?? product?.id ?? null;
      toast({
        title: mode === "create" ? "Product created" : "Product updated",
        description: mode === "create" ? "You can now assign inventory and pricing." : undefined,
      });
      onSaved(savedId);
      router.refresh();
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            placeholder="e.g., 1.5L Mixed Colour Heather"
            value={formState.name}
            onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>SKU</Label>
          <div className="flex gap-2">
            <Select
              value={formState.skuId}
              onValueChange={(value) => setFormState((prev) => ({ ...prev, skuId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select SKU" />
              </SelectTrigger>
              <SelectContent>
                {skus.map((sku) => (
                  <SelectItem key={sku.id} value={sku.id}>
                    {sku.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {onCreateSku && (
              <Button type="button" variant="outline" onClick={onCreateSku}>
                New SKU
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          rows={4}
          placeholder="Short marketing description shown to sales and customers."
          value={formState.description ?? ""}
          onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Default status</Label>
          <Input
            placeholder="e.g., Bud & flower"
            value={formState.defaultStatus ?? ""}
            onChange={(event) => setFormState((prev) => ({ ...prev, defaultStatus: event.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Hero image URL</Label>
          <Input
            placeholder="https://…"
            value={formState.heroImageUrl ?? ""}
            onChange={(event) => setFormState((prev) => ({ ...prev, heroImageUrl: event.target.value }))}
          />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label>Active</Label>
          <p className="text-sm text-muted-foreground">Inactive products stay hidden from ordering tools.</p>
        </div>
        <Switch checked={formState.isActive} onCheckedChange={(checked) => setFormState((prev) => ({ ...prev, isActive: checked }))} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Create product" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

type ProductInventorySectionProps = {
  productId: string;
  linkedBatches: ProductSummary["batches"];
  availableBatches: ProductManagementPayload["batches"];
};

export function ProductInventorySection({ productId, linkedBatches, availableBatches }: ProductInventorySectionProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [batchOptions, setBatchOptions] = useState(availableBatches);
  const [selectedBatchId, setSelectedBatchId] = useState<string>(availableBatches[0]?.id ?? "");
  const [overrideQty, setOverrideQty] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [isRefreshingBatches, setIsRefreshingBatches] = useState(false);

  useEffect(() => {
    setBatchOptions(availableBatches);
    setSelectedBatchId((current) => {
      if (current && availableBatches.some((batch) => batch.id === current)) {
        return current;
      }
      return availableBatches[0]?.id ?? "";
    });
  }, [availableBatches]);

  const refreshSelectableBatches = useCallback(async () => {
    setIsRefreshingBatches(true);
    try {
      const response = await fetch("/api/sales/linkable-batches", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as {
        batches?: ProductManagementPayload["batches"];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load batches.");
      }
      const fetched = payload?.batches ?? [];
      setBatchOptions(fetched);
      setSelectedBatchId((current) => {
        if (current && fetched.some((batch) => batch.id === current)) {
          return current;
        }
        return fetched[0]?.id ?? "";
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({
        variant: "destructive",
        title: "Failed to load batches",
        description: message,
      });
    } finally {
      setIsRefreshingBatches(false);
    }
  }, [toast]);

  useEffect(() => {
    if (availableBatches.length === 0) {
      void refreshSelectableBatches();
    }
  }, [availableBatches.length, refreshSelectableBatches]);

  const handleAdd = () => {
    if (!selectedBatchId) {
      toast({ variant: "destructive", title: "Select a batch first" });
      return;
    }
    startTransition(async () => {
      const result = await addProductBatchAction({
        productId,
        batchId: selectedBatchId,
        availableQuantityOverride: overrideQty ? Number(overrideQty) : null,
      });
      if (!result.success) {
        toast({ variant: "destructive", title: "Link failed", description: result.error ?? "Unable to link batch." });
        return;
      }
      toast({ title: "Batch linked" });
      router.refresh();
      setOverrideQty("");
      await refreshSelectableBatches();
    });
  };

  const handleRemove = (productBatchId: string) => {
    startTransition(async () => {
      const result = await removeProductBatchAction(productBatchId);
      if (!result.success) {
        toast({ variant: "destructive", title: "Remove failed", description: result.error ?? "Unable to remove batch." });
        return;
      }
      toast({ title: "Batch removed" });
      router.refresh();
      await refreshSelectableBatches();
    });
  };

  const handleAutoLink = () => {
    startTransition(async () => {
      const result = await autoLinkProductBatchesAction(productId);
      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Auto-link failed",
          description: result.error ?? "Unable to link matching batches.",
        });
        return;
      }
      const linkedCount = result.linked ?? 0;
      toast({
        title:
          linkedCount > 0
            ? `Linked ${linkedCount} batch${linkedCount === 1 ? "" : "es"}`
            : "No matching batches found",
        description:
          linkedCount > 0
            ? "Matched on SKU variety and size."
            : result.message ?? "Update the SKU variety/size to enable matching.",
      });
      router.refresh();
      await refreshSelectableBatches();
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3">
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label>Link a finished batch</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAutoLink}
                disabled={pending || batchOptions.length === 0}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Auto-link matching
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refreshSelectableBatches()}
                disabled={pending || isRefreshingBatches}
              >
                {isRefreshingBatches && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Refresh list
              </Button>
            </div>
          </div>
          <Select
            value={selectedBatchId}
            onValueChange={setSelectedBatchId}
            disabled={batchOptions.length === 0 || pending}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose batch" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {batchOptions.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  No saleable batches found
                </SelectItem>
              ) : (
                batchOptions.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.label} ({batch.quantity} units)
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {batchOptions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Mark batches as “Ready for Sale” or “Looking Good” and refresh to see them here.
            </p>
          )}
        </div>
        <div className="mt-3 space-y-2">
          <Label>Available quantity override (optional)</Label>
          <Input
            type="number"
            placeholder="Override total quantity (optional)"
            value={overrideQty}
            onChange={(event) => setOverrideQty(event.target.value)}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleAdd} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Link batch
          </Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Linked batches</h4>
        </div>
        {linkedBatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No batches linked yet.</p>
        ) : (
          <div className="space-y-3">
            {/* Summary */}
            {(() => {
              const available = linkedBatches.filter(b => b.batch?.behavior === "available");
              const pipeline = linkedBatches.filter(b => b.batch?.behavior !== "available");
              const availableQty = available.reduce((sum, b) => sum + (b.batch?.quantity ?? 0), 0);
              const pipelineQty = pipeline.reduce((sum, b) => sum + (b.batch?.quantity ?? 0), 0);
              return (
                <div className="flex gap-4 p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-2xl font-bold text-green-700">{availableQty}</p>
                    <p className="text-xs text-muted-foreground">Available now</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{pipelineQty}</p>
                    <p className="text-xs text-muted-foreground">In pipeline</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{linkedBatches.length}</p>
                    <p className="text-xs text-muted-foreground">Total batches</p>
                  </div>
                </div>
              );
            })()}
            {linkedBatches.map((entry) => {
              const isAvailable = entry.batch?.behavior === "available";
              return (
                <div key={entry.id} className={`flex items-start justify-between rounded-lg border p-3 ${isAvailable ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                  <div>
                    <p className="font-medium">
                      #{entry.batch?.batchNumber ?? "Unknown"}{" "}
                      <span className="text-muted-foreground">
                        {entry.batch?.varietyName ?? "Variety"} · {entry.batch?.sizeName ?? "Size"}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {entry.batch?.quantity ?? 0} units • 
                      <span className={isAvailable ? "text-green-700 font-medium" : "text-amber-700"}>
                        {" "}{isAvailable ? "Available" : entry.batch?.status ?? "Growing"}
                      </span>
                    </p>
                    {entry.availableQuantityOverride !== null ? (
                      <p className="text-xs text-muted-foreground">Override: {entry.availableQuantityOverride}</p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleRemove(entry.id)}
                    disabled={pending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

type ProductPricingSectionProps = {
  productId: string;
  priceLists: ProductManagementPayload["priceLists"];
  prices: ProductSummary["prices"];
};

export function ProductPricingSection({ productId, priceLists, prices }: ProductPricingSectionProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const priceMap = useMemo(() => {
    const map = new Map<string, ProductSummary["prices"][number]>();
    prices.forEach((price) => map.set(price.priceListId, price));
    return map;
  }, [prices]);
  const [drafts, setDrafts] = useState<Record<string, { price: string; minQty: string }>>({});

  useEffect(() => {
    const initial: Record<string, { price: string; minQty: string }> = {};
    priceLists.forEach((pl) => {
      const entry = priceMap.get(pl.id);
      initial[pl.id] = {
        price: entry ? String(entry.unitPriceExVat) : "",
        minQty: entry ? String(entry.minQty) : "1",
      };
    });
    setDrafts(initial);
  }, [priceLists, priceMap]);

  const handleDraftChange = (priceListId: string, field: "price" | "minQty", value: string) => {
    setDrafts((prev) => ({ ...prev, [priceListId]: { ...prev[priceListId], [field]: value } }));
  };

  const handleSavePrice = (priceListId: string) => {
    const draft = drafts[priceListId];
    if (!draft?.price) {
      toast({ variant: "destructive", title: "Price required", description: "Enter a price before saving." });
      return;
    }
    const parsedPrice = Number(draft.price);
    const parsedMinQty = Number(draft.minQty || 1);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      toast({ variant: "destructive", title: "Invalid price value" });
      return;
    }
    if (Number.isNaN(parsedMinQty) || parsedMinQty < 1) {
      toast({ variant: "destructive", title: "Invalid minimum quantity" });
      return;
    }
    setPendingId(priceListId);
    upsertProductPriceAction({
      productId,
      priceListId,
      unitPriceExVat: parsedPrice,
      minQty: parsedMinQty,
      currency: priceLists.find((pl) => pl.id === priceListId)?.currency ?? "EUR",
    }).then((result) => {
      if (!result.success) {
        toast({ variant: "destructive", title: "Save failed", description: result.error ?? "Unable to save price." });
      } else {
        toast({ title: "Price saved" });
        router.refresh();
      }
      setPendingId(null);
    });
  };

  const handleDeletePrice = (priceId: string) => {
    setPendingId(priceId);
    deleteProductPriceAction(priceId).then((result) => {
      if (!result.success) {
        toast({ variant: "destructive", title: "Delete failed", description: result.error ?? "Unable to remove price." });
      } else {
        toast({ title: "Price removed" });
        router.refresh();
      }
      setPendingId(null);
    });
  };

  return (
    <div className="space-y-4">
      {priceLists.map((priceList) => {
        const entry = priceMap.get(priceList.id);
        const draft = drafts[priceList.id] ?? { price: "", minQty: "1" };
        const pending = pendingId === priceList.id || pendingId === entry?.id;
        return (
          <div key={priceList.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{priceList.name}</p>
                <p className="text-sm text-muted-foreground">
                  Currency: {priceList.currency} {priceList.isDefault ? "• Default list" : ""}
                </p>
              </div>
              {entry ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  title="Remove price"
                  onClick={() => handleDeletePrice(entry.id)}
                  disabled={pending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Unit price (ex VAT)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft.price}
                  onChange={(event) => handleDraftChange(priceList.id, "price", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Minimum order qty</Label>
                <Input
                  type="number"
                  min="1"
                  value={draft.minQty}
                  onChange={(event) => handleDraftChange(priceList.id, "minQty", event.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => handleSavePrice(priceList.id)} disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {entry ? "Update price" : "Save price"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type AssignmentsCardProps = {
  priceLists: ProductManagementPayload["priceLists"];
  customers: ProductManagementPayload["customers"];
  assignments: ProductManagementPayload["priceListCustomers"];
};

export function PriceListAssignmentsCard({ priceLists, customers, assignments }: AssignmentsCardProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [assignmentForm, setAssignmentForm] = useState(() => ({
    priceListId: priceLists[0]?.id ?? "",
    customerId: customers[0]?.id ?? "",
    validFrom: "",
    validTo: "",
  }));
  const [defaultForm, setDefaultForm] = useState(() => ({
    customerId: customers[0]?.id ?? "",
    priceListId: customers[0]?.defaultPriceListId ?? "",
  }));
  const [pendingAssignment, startAssign] = useTransition();
  const [pendingDefault, startDefault] = useTransition();

  useEffect(() => {
    setAssignmentForm((prev) => ({
      ...prev,
      priceListId: priceLists[0]?.id ?? "",
      customerId: customers[0]?.id ?? "",
    }));
    setDefaultForm({
      customerId: customers[0]?.id ?? "",
      priceListId: customers[0]?.defaultPriceListId ?? "",
    });
  }, [priceLists, customers]);

  const handleAssign = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assignmentForm.priceListId || !assignmentForm.customerId) {
      toast({ variant: "destructive", title: "Select a customer and price list" });
      return;
    }
    startAssign(async () => {
      const result = await upsertPriceListCustomerAction({
        priceListId: assignmentForm.priceListId,
        customerId: assignmentForm.customerId,
        validFrom: assignmentForm.validFrom || undefined,
        validTo: assignmentForm.validTo || undefined,
      });
      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Assignment failed",
          description: result.error ?? "Unable to assign price list.",
        });
        return;
      }
      toast({ title: "Price list assigned" });
      router.refresh();
      setAssignmentForm((prev) => ({ ...prev, validFrom: "", validTo: "" }));
    });
  };

  const handleAssignmentDelete = (id: string) => {
    startAssign(async () => {
      const result = await deletePriceListCustomerAction(id);
      if (!result.success) {
        toast({ variant: "destructive", title: "Remove failed", description: result.error ?? "Unable to remove entry." });
        return;
      }
      toast({ title: "Assignment removed" });
      router.refresh();
    });
  };

  const handleDefaultSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!defaultForm.customerId) {
      toast({ variant: "destructive", title: "Select a customer" });
      return;
    }
    startDefault(async () => {
      const result = await setCustomerDefaultPriceListAction(
        defaultForm.customerId,
        defaultForm.priceListId || null
      );
      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Save failed",
          description: result.error ?? "Unable to set default price list.",
        });
        return;
      }
      toast({ title: "Default price list saved" });
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price list assignments</CardTitle>
        <CardDescription>Map customers to price lists and manage overrides.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-3" onSubmit={handleAssign}>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <Select
                value={assignmentForm.customerId}
                onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, customerId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Price list</Label>
              <Select
                value={assignmentForm.priceListId}
                onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, priceListId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select price list" />
                </SelectTrigger>
                <SelectContent>
                  {priceLists.map((priceList) => (
                    <SelectItem key={priceList.id} value={priceList.id}>
                      {priceList.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valid from (optional)</Label>
              <Input
                type="date"
                value={assignmentForm.validFrom}
                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, validFrom: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valid to (optional)</Label>
              <Input
                type="date"
                value={assignmentForm.validTo}
                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, validTo: event.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pendingAssignment}>
              {pendingAssignment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign price list
            </Button>
          </div>
        </form>

        <Separator />

        <form className="grid gap-3 md:grid-cols-3" onSubmit={handleDefaultSubmit}>
          <div className="space-y-1.5">
            <Label>Customer default list</Label>
            <Select
              value={defaultForm.customerId}
              onValueChange={(value) => {
                setDefaultForm({
                  customerId: value,
                  priceListId: customers.find((c) => c.id === value)?.defaultPriceListId ?? "",
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose customer" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Default price list</Label>
            <Select
              value={defaultForm.priceListId || "none"}
              onValueChange={(value) => setDefaultForm((prev) => ({ ...prev, priceListId: value === "none" ? "" : value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select price list" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {priceLists.map((priceList) => (
                  <SelectItem key={priceList.id} value={priceList.id}>
                    {priceList.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end justify-end">
            <Button type="submit" disabled={pendingDefault}>
              {pendingDefault && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save default
            </Button>
          </div>
        </form>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">Existing assignments</h4>
          </div>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No customer-specific assignments yet.</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="flex items-start justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{assignment.customerName}</p>
                    <p className="text-sm text-muted-foreground">{assignment.priceListName}</p>
                    {(assignment.validFrom || assignment.validTo) && (
                      <p className="text-xs text-muted-foreground">
                        {formatDateRange(assignment.validFrom, assignment.validTo)}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleAssignmentDelete(assignment.id)}
                    disabled={pendingAssignment}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDateRange(from?: string | null, to?: string | null) {
  const format = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
  return `From ${format(from)} · To ${format(to)}`;
}

type ProductAliasesSectionProps = {
  productId: string;
  aliases: ProductSummary["aliases"];
  customers: ProductManagementPayload["customers"];
  priceLists: ProductManagementPayload["priceLists"];
};

export function ProductAliasesSection({ productId, aliases, customers, priceLists }: ProductAliasesSectionProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [form, setForm] = useState({
    aliasName: "",
    customerId: "",
    customerSkuCode: "",
    customerBarcode: "",
    unitPriceExVat: "",
    rrp: "",
    priceListId: "",
    notes: "",
  });
  const [pending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.aliasName.trim()) {
      toast({ variant: "destructive", title: "Alias name required" });
      return;
    }
    startTransition(async () => {
      const result = await upsertProductAliasAction({
        productId,
        aliasName: form.aliasName.trim(),
        customerId: form.customerId || null,
        customerSkuCode: form.customerSkuCode || null,
        customerBarcode: form.customerBarcode || null,
        unitPriceExVat: form.unitPriceExVat ? Number(form.unitPriceExVat) : null,
        rrp: form.rrp ? Number(form.rrp) : null,
        priceListId: form.priceListId || null,
        notes: form.notes || null,
      });
      if (!result.success) {
        toast({ variant: "destructive", title: "Save failed", description: result.error ?? "Unable to save alias." });
        return;
      }
      toast({ title: "Alias saved" });
      setForm({
        aliasName: "",
        customerId: "",
        customerSkuCode: "",
        customerBarcode: "",
        unitPriceExVat: "",
        rrp: "",
        priceListId: "",
        notes: "",
      });
      router.refresh();
    });
  };

  const handleDelete = (aliasId: string) => {
    startTransition(async () => {
      const result = await deleteProductAliasAction(aliasId);
      if (!result.success) {
        toast({ variant: "destructive", title: "Delete failed", description: result.error ?? "Unable to delete alias." });
        return;
      }
      toast({ title: "Alias removed" });
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <form className="space-y-4 rounded-lg border p-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Alias name</Label>
            <Input
              placeholder="Customer sees this name"
              value={form.aliasName}
              onChange={(event) => setForm((prev) => ({ ...prev, aliasName: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Assign to customer (optional)</Label>
            <Select
              value={form.customerId || "__none__"}
              onValueChange={(value) => setForm((prev) => ({ ...prev, customerId: value === "__none__" ? "" : value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All customers" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="__none__">All customers</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Customer SKU</Label>
            <Input
              placeholder="e.g., ACME-001"
              value={form.customerSkuCode}
              onChange={(event) => setForm((prev) => ({ ...prev, customerSkuCode: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Customer barcode</Label>
            <Input
              placeholder="Optional barcode"
              value={form.customerBarcode}
              onChange={(event) => setForm((prev) => ({ ...prev, customerBarcode: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Unit price (ex VAT)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Use price list if blank"
              value={form.unitPriceExVat}
              onChange={(event) => setForm((prev) => ({ ...prev, unitPriceExVat: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>RRP (for labels)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Customer sells at this price"
              value={form.rrp}
              onChange={(event) => setForm((prev) => ({ ...prev, rrp: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Price list (optional)</Label>
            <Select
              value={form.priceListId || "__none__"}
              onValueChange={(value) => setForm((prev) => ({ ...prev, priceListId: value === "__none__" ? "" : value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {priceLists.map((pl) => (
                  <SelectItem key={pl.id} value={pl.id}>
                    {pl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Add alias"}
          </Button>
        </div>
      </form>

      <div className="space-y-4">
        <h4 className="font-semibold">Existing aliases</h4>
        {aliases.length === 0 ? (
          <p className="text-sm text-muted-foreground">No aliases defined yet.</p>
        ) : (
          <div className="space-y-3">
            {aliases.map((alias) => (
              <div key={alias.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{alias.aliasName}</p>
                    <p className="text-sm text-muted-foreground">
                      {alias.customerSkuCode || "No customer SKU"} • {alias.customerName ?? "All customers"}
                    </p>
                    {(alias.unitPriceExVat !== null || alias.rrp !== null) && (
                      <p className="text-sm text-muted-foreground">
                        {alias.unitPriceExVat !== null && `Price: €${alias.unitPriceExVat.toFixed(2)}`}
                        {alias.unitPriceExVat !== null && alias.rrp !== null && " • "}
                        {alias.rrp !== null && `RRP: €${alias.rrp.toFixed(2)}`}
                      </p>
                    )}
                    {alias.priceListName && (
                      <p className="text-xs text-muted-foreground">Price list: {alias.priceListName}</p>
                    )}
                    {alias.notes && <p className="text-xs text-muted-foreground mt-2">{alias.notes}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleDelete(alias.id)}
                    disabled={pending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

