"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { toast } from "@/lib/toast";
import { emitMutation } from "@/lib/events/mutation-events";
import ProductSkuSheet from "./ProductSkuSheet";
import { deleteProductAction } from "./actions";
import {
  ProductDetailsSection,
  ProductInventorySection,
  ProductPricingSection,
  ProductAliasesSection,
  BatchMatchingSection,
} from "./ProductManagementClient";
import type { ProductSummary, ProductManagementPayload, ProductSkuOption } from "./types";

type Props = {
  mode: "create" | "edit";
  product: ProductSummary | null;
  skus: ProductManagementPayload["skus"];
  batches: ProductManagementPayload["batches"];
  priceLists: ProductManagementPayload["priceLists"];
  customers: ProductManagementPayload["customers"];
  plantVarieties?: ProductManagementPayload["plantVarieties"];
  plantSizes?: ProductManagementPayload["plantSizes"];
};

export default function ProductFormClient({ mode, product, skus, batches, priceLists, customers, plantVarieties, plantSizes }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"details" | "inventory" | "pricing">("details");
  const [productId, setProductId] = useState<string | null>(product?.id ?? null);
  const [skuSheetOpen, setSkuSheetOpen] = useState(false);
  const [skuOptions, setSkuOptions] = useState<ProductSkuOption[]>(skus);
  const [lastCreatedSkuId, setLastCreatedSkuId] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  useEffect(() => {
    setProductId(product?.id ?? null);
    setActiveTab(product?.id ? "inventory" : "details");
    setSkuOptions(skus);
  }, [product?.id, skus]);

  const handleDelete = () => {
    if (!product?.id) return;
    startDeleting(async () => {
      const result = await deleteProductAction(product.id);
      if (!result.success) {
        toast.error(result.error ?? "Unable to delete product.");
        return;
      }
      toast.success("Product deleted");
      emitMutation({ resource: "products", action: "delete", id: product.id });
      router.push("/sales/products");
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="inventory" disabled={!productId}>
              Batches
            </TabsTrigger>
            <TabsTrigger value="pricing" disabled={!productId}>
              Pricing
            </TabsTrigger>
            <TabsTrigger value="aliases" disabled={!productId}>
              Aliases
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6 pt-4">
            <ProductDetailsSection
              mode={mode}
              product={product}
              skus={skuOptions}
              onCreateSku={() => setSkuSheetOpen(true)}
              forcedSkuId={lastCreatedSkuId}
              onForcedSkuApplied={() => setLastCreatedSkuId(null)}
              plantSizes={plantSizes}
              onSaved={(id) => {
                toast.success(mode === "create" ? "Product created" : "Product updated");
                if (mode === "create" && id) {
                  // Redirect to edit page so inventory/pricing/aliases tabs work
                  router.push(`/sales/products/${id}`);
                } else {
                  setProductId(id);
                  if (id) setActiveTab("inventory");
                }
              }}
            />
            <Separator />
            {mode === "create" ? (
              <p className="text-sm text-muted-foreground">
                Save the product to unlock inventory and pricing tabs.
              </p>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Danger zone: permanently delete this product.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isDeleting}>
                      {isDeleting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Delete product
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this product?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove "{product?.name}" and its linked pricing. Batches will remain untouched.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </TabsContent>

          <TabsContent value="inventory" className="pt-4 space-y-6">
            {productId ? (
              <>
                <BatchMatchingSection
                  productId={productId}
                  matchFamilies={product?.matchFamilies ?? null}
                  matchGenera={product?.matchGenera ?? null}
                  plantVarieties={plantVarieties ?? []}
                />
                <Separator />
                <ProductInventorySection
                  productId={productId}
                  linkedBatches={product?.batches ?? []}
                  availableBatches={batches}
                />
              </>
            ) : (
              <InlineHint label="Save product details before linking batches." />
            )}
          </TabsContent>

          <TabsContent value="pricing" className="pt-4">
            {productId ? (
              <ProductPricingSection productId={productId} priceLists={priceLists} prices={product?.prices ?? []} />
            ) : (
              <InlineHint label="Save product details before adding pricing." />
            )}
          </TabsContent>
          <TabsContent value="aliases" className="pt-4">
            {productId ? (
              <ProductAliasesSection
                productId={productId}
                aliases={product?.aliases ?? []}
                customers={customers}
                priceLists={priceLists}
              />
            ) : (
              <InlineHint label="Save product details before managing aliases." />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <ProductSkuSheet
        open={skuSheetOpen}
        onOpenChange={setSkuSheetOpen}
        onCreated={(sku) => {
          setSkuOptions((prev) => [sku, ...prev]);
          setLastCreatedSkuId(sku.id);
          setSkuSheetOpen(false);
          toast.success(`${sku.code} has been added.`);
        }}
      />
    </Card>
  );
}

function InlineHint({ label }: { label: string }) {
  return (
    <Alert>
      <AlertTitle>Action required</AlertTitle>
      <AlertDescription>{label}</AlertDescription>
    </Alert>
  );
}

