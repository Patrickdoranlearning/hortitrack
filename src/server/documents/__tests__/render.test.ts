import { renderDocumentHtml } from "@/server/documents/render";

describe("renderDocumentHtml", () => {
  it("replaces bindings in text components", () => {
    const html = renderDocumentHtml(
      [{ id: "h1", type: "heading", text: "Hello {{customer.name}}" }],
      { customer: { name: "Mia" } }
    );
    expect(html).toContain("Hello Mia");
  });
});



