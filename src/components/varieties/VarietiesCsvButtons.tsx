
"use client";

import * as React from "react";
import { Button } from "../ui/button";
import { Download, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function VarietiesCsvButtons() {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<"down" | "up" | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function download() {
    setBusy("down");
    try {
      const res = await fetch("/api/plant-varieties/export");
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `plant_varieties_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Download failed", description: e?.message || String(e) });
    } finally {
      setBusy(null);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy("up");
    try {
      const fd = new FormData();
      fd.set("file", f, f.name);
      fd.set("dryRun", "false");
      fd.set("upsertBy", "name");
      const res = await fetch("/api/plant-varieties/import", { method: "POST", body: fd });
      const text = await res.text();
      let json: any = {};
      try { json = JSON.parse(text); } catch { throw new Error(text); }
      if (!res.ok || json?.error) throw new Error(json?.error || "Import failed");
      const { summary } = json;
      toast({
        title: "Import complete",
        description: `${summary.created} created, ${summary.updated} updated, ${summary.errors} errors.`
      });
      // Refresh the page to show new data
      window.location.reload();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Upload failed", description: e?.message || String(e) });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        onClick={download}
        disabled={busy === "down"}
      >
        <Download className="mr-2 h-4 w-4" />
        {busy === "down" ? "Preparing…" : "Download CSV"}
      </Button>

      <Button
        variant="outline"
        onClick={() => fileRef.current?.click()}
        disabled={busy === "up"}
      >
        <Upload className="mr-2 h-4 w-4" />
        {busy === "up" ? "Uploading…" : "Upload CSV"}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}
