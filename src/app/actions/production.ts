"use server";

import { createPropagationBatch } from "@/server/batches/service";
import { PropagationFormSchema } from "@/types/batch";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import type { ActionResult } from "@/lib/errors";
import { logError } from "@/lib/log";

export async function createPropagationBatchAction(
  input: z.infer<typeof PropagationFormSchema>
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { user } = await getUserAndOrg();

    const batch = await createPropagationBatch({
      input: {
        ...input,
        varietyId: input.varietyId ?? input.variety,
        plant_variety_id: input.varietyId ?? input.variety,
      },
      userId: user.id,
    });
    return { success: true, data: batch };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    logError("createPropagationBatchAction error", { error: message, raw: e instanceof Error ? e.stack : String(e) });
    return { success: false, error: message };
  }
}

