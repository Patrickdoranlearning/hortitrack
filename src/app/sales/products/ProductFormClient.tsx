"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import ProductSkuSheet from "./ProductSkuSheet";
import {
  ProductDetailsSection,
  ProductInventorySection,
  ProductPricingSection,
  ProductAliasesSection,
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
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"details" | "inventory" | "pricing">("details");
  const [productId, setProductId] = useState<string | null>(product?.id ?? null);
  const [skuSheetOpen, setSkuSheetOpen] = useState(false);
  const [skuOptions, setSkuOptions] = useState<ProductSkuOption[]>(skus);
  const [lastCreatedSkuId, setLastCreatedSkuId] = useState<string | null>(null);

  useEffect(() => {
    setProductId(product?.id ?? null);
    setActiveTab(product?.id ? "inventory" : "details");
    setSkuOptions(skus);
  }, [product?.id, skus]);

  return (
    <Card>
      <CardContent className="pt-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="inventory" disabled={!productId}>
              Inventory
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
              plantVarieties={plantVarieties}
              plantSizes={plantSizes}
              onSaved={(id) => {
                toast({
                  title: mode === "create" ? "Product created" : "Product updated",
                  description: "Product details have been saved successfully.",
                });
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
            <p className="text-sm text-muted-foreground">
              Save the product to unlock inventory and pricing tabs.
            </p>
          </TabsContent>

          <TabsContent value="inventory" className="pt-4">
            {productId ? (
              <ProductInventorySection
                productId={productId}
                linkedBatches={product?.batches ?? []}
                availableBatches={batches}
              />
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
          toast({
            title: "SKU created",
            description: `${sku.code} has been added.`,
          });
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

