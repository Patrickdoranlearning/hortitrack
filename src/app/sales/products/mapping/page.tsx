import { getUserAndOrg } from "@/server/auth/org";
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchProductManagementData, mapProducts, buildBatchMappings } from "../product-data";
import ProductBatchMappingClient from "../ProductBatchMappingClient";
import MappingRulesClient from "../MappingRulesClient";

export default async function ProductBatchMappingPage() {
  const { orgId, supabase } = await getUserAndOrg();
  const data = await fetchProductManagementData(supabase, orgId);
  const products = mapProducts(data.productRows);
  const batchMappings = buildBatchMappings(data.productRows, data.batches);

  // Fetch mapping rules
  const { data: rulesData } = await supabase
    .from("product_mapping_rules")
    .select(`
      *,
      product:products(id, name),
      size:plant_sizes(id, name),
      location:nursery_locations(id, name)
    `)
    .eq("org_id", orgId)
    .order("priority", { ascending: true });

  // Fetch sizes and locations for rule creation
  // Note: plant_sizes is a shared table without org_id
  const [sizesResult, locationsResult, varietiesResult, statusesResult] = await Promise.all([
    supabase.from("plant_sizes").select("id, name").order("name"),
    supabase.from("nursery_locations").select("id, name").eq("org_id", orgId).order("name"),
    supabase.from("plant_varieties").select("family, genus, category").eq("org_id", orgId),
    supabase
      .from("attribute_options")
      .select("id, label, behavior")
      .eq("org_id", orgId)
      .eq("attribute_key", "production_status"),
  ]);

  // Extract unique families, genera, categories
  const families = [...new Set((varietiesResult.data ?? []).map((v) => v.family).filter(Boolean))] as string[];
  const genera = [...new Set((varietiesResult.data ?? []).map((v) => v.genus).filter(Boolean))] as string[];
  const categories = [...new Set((varietiesResult.data ?? []).map((v) => v.category).filter(Boolean))] as string[];

  // Map rules to expected format
  const rules = (rulesData ?? []).map((r) => ({
    id: r.id,
    productId: r.product_id,
    name: r.name,
    matchFamily: r.match_family,
    matchGenus: r.match_genus,
    matchCategory: r.match_category,
    matchSizeId: r.match_size_id,
    matchLocationId: r.match_location_id,
    minAgeWeeks: r.min_age_weeks,
    maxAgeWeeks: r.max_age_weeks,
    matchStatusIds: r.match_status_ids,
    priority: r.priority,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    product: r.product,
    size: r.size,
    location: r.location,
  }));

  const productionStatuses = (statusesResult.data ?? []).map((s) => ({
    id: s.id,
    label: s.label,
    behavior: s.behavior ?? "growing",
  }));

  return (
    <PageFrame moduleKey="sales">
      <ModulePageHeader
        title="Product Mapping"
        description="Configure rules and manage batch-to-product links for sales inventory."
      />

      <Tabs defaultValue="rules" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="rules">Mapping Rules</TabsTrigger>
          <TabsTrigger value="batches">Manual Mapping</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <MappingRulesClient
            rules={rules}
            products={products}
            sizes={sizesResult.data ?? []}
            locations={locationsResult.data ?? []}
            productionStatuses={productionStatuses}
            families={families.sort()}
            genera={genera.sort()}
            categories={categories.sort()}
          />
        </TabsContent>

        <TabsContent value="batches">
          <ProductBatchMappingClient batches={batchMappings} products={products} />
        </TabsContent>
      </Tabs>
    </PageFrame>
  );
}
