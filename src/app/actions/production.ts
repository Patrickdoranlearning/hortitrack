"use server";

import { createPropagationBatch } from "@/server/batches/service";
import { PropagationFormSchema } from "@/types/batch";
import { z } from "zod";
import { getUserIdAndOrgId } from "@/server/auth/getUser";

export async function createPropagationBatchAction(input: z.infer<typeof PropagationFormSchema>) {
  try {
    const { userId } = await getUserIdAndOrgId();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const batch = await createPropagationBatch({
      input: {
        ...input,
        varietyId: input.varietyId ?? input.variety,
        plant_variety_id: input.varietyId ?? input.variety,
      },
      userId,
    });
    return { success: true, data: batch };
  } catch (e: any) {
    console.error("createPropagationBatchAction error", e);
    return { success: false, error: e.message };
  }
}

