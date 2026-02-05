import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ATTRIBUTE_META, type AttributeKey, type AttributeBehavior } from "@/lib/attributeOptions";
import { getUserAndOrg } from "@/server/auth/org";
import { assertValidAttributeKey, listAttributeOptions, saveAttributeOptions } from "@/server/attributeOptions/service";

const OptionInputSchema = z.object({
  id: z.string().uuid().optional(),
  systemCode: z.string().min(1).optional(),
  displayLabel: z.string().min(1),
  isActive: z.boolean().optional(),
  behavior: z.string().optional(),
  color: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

const BodySchema = z.object({
  options: z.array(OptionInputSchema),
});

const ALLOWED_BEHAVIORS: AttributeBehavior[] = ["growing", "available", "waste", "archived"];

function parseAttributeKey(raw: string): AttributeKey {
  assertValidAttributeKey(raw);
  return raw;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ attributeKey: string }> }) {
  try {
    const { attributeKey: rawKey } = await params;
    const attributeKey = parseAttributeKey(rawKey);
    const includeInactive = ["1", "true", "yes"].includes((req.nextUrl.searchParams.get("includeInactive") ?? "").toLowerCase());

    const { orgId, supabase } = await getUserAndOrg();
    const { options, source } = await listAttributeOptions({ orgId, attributeKey, includeInactive, supabase });

    return NextResponse.json({ options, source, meta: ATTRIBUTE_META[attributeKey] });
  } catch (e: any) {
    console.error(`[OPTIONS API] Error for ${(await params).attributeKey}:`, e?.message, e?.stack);
    const status = /Unauthenticated/i.test(e?.message) ? 401 : e?.message === "Unknown attribute key" ? 404 : 500;
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ attributeKey: string }> }) {
  try {
    const { attributeKey: rawKey } = await params;
    console.log(`[OPTIONS API PUT] Starting for ${rawKey}`);
    const attributeKey = parseAttributeKey(rawKey);
    const body = BodySchema.parse(await req.json());
    console.log(`[OPTIONS API PUT] Body parsed, ${body.options.length} options`);

    const { orgId, supabase } = await getUserAndOrg();
    console.log(`[OPTIONS API PUT] Got orgId: ${orgId}`);

    const cleaned = body.options.map((opt) => {
      const behavior =
        ATTRIBUTE_META[attributeKey]?.requiresBehavior && opt.behavior
          ? (ALLOWED_BEHAVIORS.includes(opt.behavior as AttributeBehavior) ? (opt.behavior as AttributeBehavior) : "growing")
          : undefined;
      return {
        ...opt,
        behavior,
      };
    });

    console.log(`[OPTIONS API PUT] Calling saveAttributeOptions`);
    const { options, source } = await saveAttributeOptions({ orgId, attributeKey, options: cleaned, supabase });
    console.log(`[OPTIONS API PUT] Save successful, ${options.length} options returned`);

    return NextResponse.json({ options, source });
  } catch (e: any) {
    console.error(`[OPTIONS API PUT] Error for ${(await params).attributeKey}:`, e?.message, e?.stack);
    if (e?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid payload", issues: e.issues }, { status: 400 });
    }
    const status = /Unauthenticated/i.test(e?.message) ? 401 : e?.message === "Unknown attribute key" ? 404 : 500;
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status });
  }
}

