// src/lib/referenceData/service.ts

// Client-side logging (development only) - production uses structured logger on server
const isDev = process.env.NODE_ENV === "development";
const log = {
  info: (msg: string) => isDev && console.info(`[refdata] ${msg}`),
  warn: (msg: string) => isDev && console.warn(`[refdata] ${msg}`),
  error: (msg: string, err?: unknown) => isDev && console.error(`[refdata] ${msg}`, err),
};

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
  materials: Array<{
    id: string;
    name: string;
    part_number: string;
    category_id: string;
    category_name: string | null;
    category_code: string | null;
    parent_group: string | null;
    base_uom: string;
    linked_size_id: string | null;
    is_active: boolean;
  }>;
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
  log.info("fetching /api/reference-data");
  const res = await fetch("/api/reference-data", { method: "GET", cache: "no-store" });
  log.info(`fetch complete, status: ${res.status}`);

  if (!res.ok && res.status !== 207) {
    const text = await res.text().catch(() => "");
    const payload = text ? JSON.parse(text) : {};
    const msg = payload?.error || text;
    log.warn(`HTTP ${res.status}: ${msg}`);
    // Allow 401 to pass through as a soft error (varieties/sizes may still be present)
    return { varieties: payload?.varieties ?? [], sizes: payload?.sizes ?? [], locations: payload?.locations ?? [], suppliers: payload?.suppliers ?? [], materials: payload?.materials ?? [], errors: payload?.errors ?? [`HTTP ${res.status}: ${msg || "no body"}`] };
  }

  const json = await res.json().catch((e) => {
    log.error("invalid JSON", e);
    return null;
  });

  if (!json) {
    return { varieties: [], sizes: [], locations: [], suppliers: [], materials: [], errors: ["Invalid JSON"] };
  }

  const errors = Array.isArray(json.errors) ? stringifyErrors(json.errors) : [];

  if (errors.length) {
    for (const line of errors) {
      const msg = typeof line === "string" ? line : JSON.stringify(line);
      if (msg.includes("Unauthenticated")) {
        log.info(msg);
      } else {
        log.warn(msg);
      }
    }
  }


  return {
    varieties: json.varieties ?? [],
    sizes: json.sizes ?? [],
    locations: json.locations ?? [],
    suppliers: json.suppliers ?? [],
    materials: json.materials ?? [],
    errors,
  };
}
