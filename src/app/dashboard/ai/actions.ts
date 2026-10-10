"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/actions/run";
import { saveAiSettings } from "@/actions/ai-assistant";

export async function saveAiSettingsAction(input: { aiBot: boolean; aiSite: boolean; aiInstructions: string }) {
  const r = await runAction(saveAiSettings, input);
  if (r.ok) revalidatePath("/dashboard/ai");
  return r;
}
