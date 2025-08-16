"use client";

export type GenerateOptions = { publish?: boolean; name?: string };

export function useGenerateProtocol() {
  async function generate(batchId: string, opts: GenerateOptions = {}) {
    const res = await fetch("/api/protocols/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId, ...opts }),
    });

    const text = await res.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { error: text?.slice(0, 200) }; }

    if (!res.ok) {
      throw new Error(json?.error || res.statusText || "Failed to generate");
    }
    return json.protocol as { id: string; name: string };
  }

  return { generate };
}
