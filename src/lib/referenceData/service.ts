// src/lib/referenceData/service.ts
export type ReferenceData = {
  varieties: Array<{
    id: string;
    name: string;
    family: string | null;
    genus: string | null;
    species: string | null;
    category: string | null;
  }>;
  sizes: Array<{ id: string; name: string; container_type: string; cell_multiple: number }>;
  locations: Array<{ id: string; name: string; nursery_site: string }>;
  suppliers: Array<{ id: string; name: string; producer_code: string | null; country_code: string }>;
  errors: string[];
};

function stringifyErrors(errs: any[]): string[] {
  try {
    return errs.map((e) =>
      JSON.stringify(
        {
          message: e?.message ?? String(e),
          code: e?.code,
          details: e?.details,
          hint: e?.hint,
        },
        null,
        2
      )
    );
  } catch {
    return errs.map((e) => String(e));
  }
}

export async function fetchReferenceData(): Promise<ReferenceData> {
  const res = await fetch("/api/reference-data", { method: "GET", cache: "no-store" });

  if (!res.ok && res.status !== 207) {
    let payload: any = null;
    try { payload = await res.json(); } catch { /* fall back */ }
    const msg = payload?.errors ? JSON.stringify(payload.errors) : await res.text().catch(() => "");
    console.error("[refdata] HTTP error", res.status, msg);
    return { varieties: [], sizes: [], locations: [], suppliers: [], errors: [`HTTP ${res.status}: ${msg}`] };
  }

  const json = await res.json().catch((e) => {
    console.error("[refdata] invalid JSON:", e);
    return null;
  });

  if (!json) {
    return { varieties: [], sizes: [], locations: [], suppliers: [], errors: ["Invalid JSON"] };
  }

  const errors = Array.isArray(json.errors) ? stringifyErrors(json.errors) : [];

  if (errors.length) {
    // Log clear, actionable error strings (no `{...}`)
    for (const line of errors) console.error("[refdata] fetch error:", line);
  }

  return {
    varieties: json.varieties ?? [],
    sizes: json.sizes ?? [],
    locations: json.locations ?? [],
    suppliers: json.suppliers ?? [],
    errors,
  };
}
