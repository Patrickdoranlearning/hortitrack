import { notFound } from "next/navigation";
import { getUserAndOrg } from "@/server/auth/org";
import { rowToProtocolSummary, type ProtocolRow } from "@/server/planning/service";
import RecipeDetailClient from "./RecipeDetailClient";

export const dynamic = "force-dynamic";

async function getProtocol(id: string) {
  const { supabase, orgId } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("protocols")
    .select(
      [
        "id",
        "org_id",
        "name",
        "description",
        "target_variety_id",
        "target_size_id",
        "is_active",
        "definition",
        "route",
        "created_at",
        "updated_at",
        "plant_varieties(name)",
        "plant_sizes(name)",
      ].join(",")
    )
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (error || !data) return null;
  return rowToProtocolSummary(data as ProtocolRow);
}

export default async function RecipeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const protocol = await getProtocol(params.id);

  if (!protocol) {
    notFound();
  }

  return <RecipeDetailClient protocol={protocol} />;
}





