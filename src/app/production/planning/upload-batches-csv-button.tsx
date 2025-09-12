"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from "uuid";
import { parse } from "csv-parse/browser/esm/sync";
import type { DraftBatch } from "./new-draft-batch-dialog";

interface Props {
  onUpload: (batches: DraftBatch[]) => void;
}

export function UploadBatchesCsvButton({ onUpload }: Props) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const text = await f.text();
      const records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];

      const batches: DraftBatch[] = records.map((r, idx) => {
        const sku = r.sku?.trim();
        const sellWeek = Number(r.sellWeek);
        const quantity = Number(r.quantity);
        if (!sku || Number.isNaN(sellWeek) || Number.isNaN(quantity)) {
          throw new Error(`Invalid data on row ${idx + 2}`);
        }
        return {
          id: uuidv4(),
          sku,
          sellWeek,
          quantity,
          recipeVersion: r.recipeVersion?.trim() || undefined,
          predictedReadyWeek: Math.max(1, sellWeek - 2),
        };
      });

      onUpload(batches);
      toast({ title: "Import complete", description: `${batches.length} draft batches added.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Upload failed", description: e?.message || String(e) });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
        <Upload className="mr-2 h-4 w-4" />
        {busy ? "Uploading…" : "Upload CSV"}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onFile}
      />
    </>
  );
}
