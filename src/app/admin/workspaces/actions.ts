"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

async function adminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  return isAdmin === true ? supabase : null;
}

const planInput = z.object({
  workspaceId: z.string().uuid(),
  planId: z.enum(["bot", "site", "site_bot", "business"]),
  status: z.enum(["trial", "active", "expired"]),
  trialEndsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export async function adminSetPlan(input: z.input<typeof planInput>): Promise<{ ok: boolean; error?: string }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "Ruxsat yo'q" };
  const parsed = planInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ma'lumot noto'g'ri" };
  const { workspaceId, planId, status, trialEndsAt } = parsed.data;
  const { error } = await supabase.rpc("admin_set_workspace_plan", {
    ws: workspaceId,
    new_plan: planId,
    new_status: status,
    // Sana Toshkent vaqti bilan kun oxirigacha
    new_trial_ends: trialEndsAt ? `${trialEndsAt}T23:59:59+05:00` : null,
  });
  if (error) return { ok: false, error: "Saqlanmadi" };
  revalidatePath("/admin/workspaces");
  return { ok: true };
}

const priceInput = z.object({
  planId: z.enum(["bot", "site", "site_bot", "business"]),
  price: z.number().int().min(0).max(1_000_000_000).nullable(),
});

export async function adminSetPrice(input: z.input<typeof priceInput>): Promise<{ ok: boolean; error?: string }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "Ruxsat yo'q" };
  const parsed = priceInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Narx noto'g'ri" };
  const { data, error } = await supabase
    .from("plans")
    .update({ price_uzs: parsed.data.price })
    .eq("id", parsed.data.planId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Saqlanmadi" };
  revalidatePath("/admin/workspaces");
  revalidatePath("/dashboard/plan");
  return { ok: true };
}
