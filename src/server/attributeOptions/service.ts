import { type SupabaseClient } from "@supabase/supabase-js";
import {
  ATTRIBUTE_META,
  type AttributeBehavior,
  type AttributeKey,
  type AttributeOption,
  type AttributeOptionInput,
  attributeKeys,
  defaultOptionsFor,
  normalizeSystemCode,
} from "@/lib/attributeOptions";
import { getSupabaseServerApp } from "@/server/db/supabase";

type ListArgs = {
  orgId: string;
  attributeKey: AttributeKey;
  includeInactive?: boolean;
  supabase?: SupabaseClient;
};

export async function listAttributeOptions({
  orgId,
  attributeKey,
  includeInactive = false,
  supabase,
}: ListArgs): Promise<{ options: AttributeOption[]; source: "custom" | "default" }> {
  const sb = supabase ?? (await getSupabaseServerApp());

  const { data, error } = await sb
    .from("attribute_options")
    .select("id, attribute_key, system_code, display_label, sort_order, is_active, behavior, color")
    .eq("org_id", orgId)
    .eq("attribute_key", attributeKey)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  const mapped =
    data?.map(
      (row) =>
        ({
          id: row.id,
          attributeKey: row.attribute_key as AttributeKey,
          systemCode: row.system_code,
          displayLabel: row.display_label,
          sortOrder: row.sort_order ?? 0,
          isActive: row.is_active ?? true,
          behavior: row.behavior as AttributeBehavior | null | undefined,
          color: row.color ?? null,
          source: "custom",
        }) satisfies AttributeOption
    ) ?? [];

  const filtered = includeInactive ? mapped : mapped.filter((o) => o.isActive);
  if (filtered.length === 0) {
    return { options: defaultOptionsFor(attributeKey, includeInactive), source: "default" };
  }
  return { options: filtered, source: "custom" };
}

type SaveArgs = {
  orgId: string;
  attributeKey: AttributeKey;
  options: AttributeOptionInput[];
  supabase?: SupabaseClient;
};

export async function saveAttributeOptions({ orgId, attributeKey, options, supabase }: SaveArgs) {
  const sb = supabase ?? (await getSupabaseServerApp());

  // Load existing ids for cleanup
  const { data: existing, error: existingErr } = await sb
    .from("attribute_options")
    .select("id")
    .eq("org_id", orgId)
    .eq("attribute_key", attributeKey);
  if (existingErr) throw new Error(existingErr.message);

  const requiresBehavior = !!ATTRIBUTE_META[attributeKey]?.requiresBehavior;

  const normalized = options.map((opt, idx) => {
    const systemCode = (opt.systemCode?.trim?.() || normalizeSystemCode(opt.displayLabel)).trim();
    const displayLabel = opt.displayLabel?.trim?.() || systemCode;
    const behavior = requiresBehavior ? (opt.behavior ?? "growing") : opt.behavior ?? null;

    return {
      id: opt.id,
      org_id: orgId,
      attribute_key: attributeKey,
      system_code: systemCode,
      display_label: displayLabel,
      sort_order: idx + 1,
      is_active: opt.isActive ?? true,
      behavior,
      color: opt.color ?? null,
    };
  });

  const { error: upsertErr } = await sb
    .from("attribute_options")
    .upsert(normalized, { onConflict: "org_id,attribute_key,system_code" });
  if (upsertErr) throw new Error(upsertErr.message);

  const keepIds = new Set(normalized.map((o) => o.id).filter(Boolean) as string[]);
  const staleIds = (existing ?? []).map((r) => r.id).filter((id): id is string => !!id && !keepIds.has(id));

  if (staleIds.length) {
    const { error: disableErr } = await sb
      .from("attribute_options")
      .update({ is_active: false, sort_order: 9999 })
      .in("id", staleIds);
    if (disableErr) throw new Error(disableErr.message);
  }

  return listAttributeOptions({ orgId, attributeKey, includeInactive: false, supabase: sb });
}

export async function getStatusCodesByBehavior(orgId: string, behavior: AttributeBehavior, supabase?: SupabaseClient) {
  const { options } = await listAttributeOptions({
    orgId,
    attributeKey: "production_status",
    includeInactive: false,
    supabase,
  });
  return options.filter((o) => o.behavior === behavior).map((o) => o.systemCode);
}

export function assertValidAttributeKey(value: string): asserts value is AttributeKey {
  if (!attributeKeys().includes(value as AttributeKey)) {
    throw new Error("Unknown attribute key");
  }
}

