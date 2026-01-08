import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getUserAndOrg } from '@/server/auth/org';
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import ProductGroupsClient from './ProductGroupsClient';

export default async function ProductGroupsPage() {
  const { orgId, supabase } = await getUserAndOrg();

  // Fetch product groups
  const { data: groups } = await supabase
    .from('product_groups')
    .select(`
      id,
      name,
      description,
      default_barcode,
      match_category,
      match_family,
      match_genus,
      match_size_ids,
      is_active,
      created_at,
      updated_at
    `)
    .eq('org_id', orgId)
    .order('name');

  // Fetch products for the member selector
  const { data: products } = await supabase
    .from('products')
    .select(`
      id,
      name,
      is_active,
      skus(
        id,
        plant_variety_id,
        size_id,
        plant_varieties(id, name, family, genus, category),
        plant_sizes(id, name)
      )
    `)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('name');

  // Fetch customers for aliases
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name')
    .eq('org_id', orgId)
    .order('name');

  // Fetch plant sizes for the group rules
  const { data: plantSizes } = await supabase
    .from('plant_sizes')
    .select('id, name')
    .order('name');

  // Get unique categories, families, genera from varieties
  const { data: varieties } = await supabase
    .from('plant_varieties')
    .select('category, family, genus')
    .not('category', 'is', null);

  const categories = [...new Set(varieties?.map((v) => v.category).filter(Boolean) ?? [])].sort();
  const families = [...new Set(varieties?.map((v) => v.family).filter(Boolean) ?? [])].sort();
  const genera = [...new Set(varieties?.map((v) => v.genus).filter(Boolean) ?? [])].sort();

  return (
    <PageFrame moduleKey="sales">
      <ModulePageHeader
        title="Product Groups"
        description="Group products for customers who order generically (e.g., '2L Perennial' instead of specific varieties)."
        actionsSlot={
          <Button asChild variant="outline">
            <Link href="/sales/products">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Products
            </Link>
          </Button>
        }
      />
      <ProductGroupsClient
        groups={
          groups?.map((g) => ({
            id: g.id,
            name: g.name,
            description: g.description,
            defaultBarcode: g.default_barcode,
            matchCategories: g.match_category as string[] | null,
            matchFamilies: g.match_family as string[] | null,
            matchGenera: g.match_genus as string[] | null,
            matchSizeIds: g.match_size_ids as string[] | null,
            isActive: g.is_active,
            createdAt: g.created_at,
            updatedAt: g.updated_at,
          })) ?? []
        }
        products={
          products?.map((p) => {
            const sku = p.skus as {
              id: string;
              plant_variety_id: string | null;
              size_id: string | null;
              plant_varieties: { id: string; name: string; family: string | null; genus: string | null; category: string | null } | null;
              plant_sizes: { id: string; name: string } | null;
            } | null;
            return {
              id: p.id,
              name: p.name,
              varietyName: sku?.plant_varieties?.name ?? null,
              sizeName: sku?.plant_sizes?.name ?? null,
              category: sku?.plant_varieties?.category ?? null,
              family: sku?.plant_varieties?.family ?? null,
              genus: sku?.plant_varieties?.genus ?? null,
            };
          }) ?? []
        }
        customers={customers ?? []}
        plantSizes={plantSizes ?? []}
        categories={categories as string[]}
        families={families as string[]}
        genera={genera as string[]}
      />
    </PageFrame>
  );
}
