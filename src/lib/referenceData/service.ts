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
  console.log("[refData] fetching /api/reference-data");
  const res = await fetch("/api/reference-data", { method: "GET", cache: "no-store" });
  console.log("[refData] fetch complete, status:", res.status);

  if (!res.ok && res.status !== 207) {
    const text = await res.text().catch(() => "");
    const payload = text ? JSON.parse(text) : {};
    const msg = payload?.error || text;
    console.warn("[refdata] HTTP", res.status, msg);
    // Allow 401 to pass through as a soft error (varieties/sizes may still be present)
    return { varieties: payload?.varieties ?? [], sizes: payload?.sizes ?? [], locations: payload?.locations ?? [], suppliers: payload?.suppliers ?? [], errors: payload?.errors ?? [`HTTP ${res.status}: ${msg || "no body"}`] };
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
    for (const line of errors) {
      const msg = typeof line === "string" ? line : JSON.stringify(line);
      if (msg.includes("Unauthenticated")) {
        console.info("[refdata] info:", msg);
      } else {
        console.warn("[refdata] warning:", msg);
      }
    }
  }


  return {
    varieties: json.varieties ?? [],
    sizes: json.sizes ?? [],
    locations: json.locations ?? [],
    suppliers: json.suppliers ?? [],
    errors,
  };
}
