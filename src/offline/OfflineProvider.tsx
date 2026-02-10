'use client';

import React from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { useActiveOrg } from "@/lib/org/context";
import { logWarning } from "@/lib/log";
import { parseScanCode, type Parsed } from "@/lib/scan/parse.client";
import {
  getOfflineDb,
  replaceOfflineBatches,
  type OfflineBatchDoc,
} from "./db";
import type { Database } from "@/types/supabase";

type OfflineContextValue = {
  ready: boolean;
  syncing: boolean;
  lastSyncedAt: Date | null;
  error?: string;
  lookupByCode: (code: string) => Promise<OfflineBatchDoc | null>;
  lookupByParsed: (parsed: Parsed) => Promise<OfflineBatchDoc | null>;
  syncNow: () => Promise<void>;
};

const OfflineContext = React.createContext<OfflineContextValue>({
  ready: false,
  syncing: false,
  lastSyncedAt: null,
  lookupByCode: async () => null,
  lookupByParsed: async () => null,
  syncNow: async () => {},
});

type BatchSearchRow = Database["public"]["Views"]["v_batch_search"]["Row"];

const mapRowToOfflineDoc = (row: BatchSearchRow): OfflineBatchDoc => ({
  id: row.id,
  orgId: row.org_id ?? null,
  batchNumber: row.batch_number ?? null,
  batchNumberIndex: (row.batch_number ?? row.id ?? "")
    .toString()
    .toLowerCase(),
  variety: row.variety_name ?? null,
  family: row.family ?? null,
  size: row.size_name ?? null,
  location: row.location_name ?? null,
  status: row.status ?? null,
  quantity: Number(row.quantity ?? 0),
  updatedAt: row.updated_at ?? null,
});

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const supabase = supabaseClient();
  const { orgId } = useActiveOrg();
  const [ready, setReady] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<Date | null>(null);

  const syncNow = React.useCallback(async () => {
    if (!orgId) {
      setReady(false);
      return;
    }
    setSyncing(true);
    setError(undefined);
    try {
      const { data, error } = await supabase
        .from("v_batch_search")
        .select(
          "id, org_id, batch_number, quantity, status, variety_name, family, size_name, location_name, updated_at"
        )
        .eq("org_id", orgId)
        .order("updated_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const rows = (data ?? []) as BatchSearchRow[];
      await replaceOfflineBatches(rows.map(mapRowToOfflineDoc));
      setReady(true);
      setLastSyncedAt(new Date());
    } catch (err) {
      // Log error but don't break the UI if offline sync fails (expected when truly offline)
      const message = err instanceof Error ? err.message : String(err);
      logWarning("Offline sync failed (you may be offline)", { error: message });
      // Only set visible error state if we haven't successfully synced yet
      if (!ready) {
        setError(message || "Offline sync failed");
      }
    } finally {
      setSyncing(false);
    }
  }, [orgId, supabase, ready]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!orgId) {
        setReady(false);
        return;
      }
      if (cancelled) return;
      await syncNow();
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, syncNow]);

  const lookupByParsed = React.useCallback(
    async (parsed: Parsed) => {
      // Allow lookup even if sync failed (best effort from existing IDB data)
      const db = await getOfflineDb();
      if (parsed.by === "id") {
        const doc = await db.batches.findOne(parsed.value).exec();
        return doc?.toJSON() ?? null;
      }
      if (parsed.by === "batchNumber") {
        const key = parsed.value.toLowerCase();
        const doc = await db.batches
          .findOne()
          .where("batchNumberIndex")
          .eq(key)
          .exec();
        return doc?.toJSON() ?? null;
      }
      return null;
    },
    []
  );

  const lookupByCode = React.useCallback(
    async (code: string) => {
      const parsed = parseScanCode(code);
      if (!parsed) return null;
      return lookupByParsed(parsed);
    },
    [lookupByParsed]
  );

  const value: OfflineContextValue = React.useMemo(
    () => ({
      ready,
      syncing,
      lastSyncedAt,
      error,
      lookupByCode,
      lookupByParsed,
      syncNow,
    }),
    [ready, syncing, lastSyncedAt, error, lookupByCode, lookupByParsed, syncNow]
  );

  return (
    <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
  );
}

export function useOfflineBatches() {
  return React.useContext(OfflineContext);
}
