import { defaultLayoutFor, DOCUMENT_FIELDS } from "@/lib/documents/presets";

describe("document presets", () => {
  it("returns a default layout per document type", () => {
    const types = ["invoice", "delivery_docket", "order_confirmation", "av_list", "lookin_good"] as const;
    for (const t of types) {
      const layout = defaultLayoutFor(t);
      expect(Array.isArray(layout)).toBe(true);
      expect(layout.length).toBeGreaterThan(0);
    }
  });

  it("provides bindings for invoice", () => {
    const fields = DOCUMENT_FIELDS.invoice;
    expect(fields.find((f) => f.path === "invoice.number")).toBeTruthy();
  });
});




