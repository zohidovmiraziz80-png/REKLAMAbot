import type { SupabaseClient } from "@supabase/supabase-js";

export type PlanId = "bot" | "site" | "site_bot";
export type PlanStatus = "trial" | "active" | "expired";

export type Plan = {
  id: PlanId;
  name: string;
  description: string;
  price_uzs: number | null;
  allow_sites: boolean;
  allow_bots: boolean;
  sort: number;
};

export type WorkspacePlan = {
  planId: PlanId;
  planName: string;
  /** Hisoblangan holat: sinov muddati o'tgan bo'lsa "expired" */
  status: PlanStatus;
  trialEndsAt: string | null;
  daysLeft: number | null;
  active: boolean;
  allowSites: boolean;
  allowBots: boolean;
};

export async function listPlans(supabase: SupabaseClient): Promise<Plan[]> {
  const { data } = await supabase.from("plans").select("id, name, description, price_uzs, allow_sites, allow_bots, sort").order("sort");
  return (data ?? []) as Plan[];
}

export async function getWorkspacePlan(supabase: SupabaseClient, workspaceId: string): Promise<WorkspacePlan> {
  const { data } = await supabase
    .from("workspaces")
    .select("plan_id, plan_status, trial_ends_at, plans ( name, allow_sites, allow_bots )")
    .eq("id", workspaceId)
    .maybeSingle();

  const plan = (Array.isArray(data?.plans) ? data?.plans[0] : data?.plans) as
    | { name: string; allow_sites: boolean; allow_bots: boolean }
    | null
    | undefined;

  const trialEndsAt = (data?.trial_ends_at as string | null | undefined) ?? null;
  let status = ((data?.plan_status as PlanStatus | undefined) ?? "trial") as PlanStatus;
  let daysLeft: number | null = null;
  if (status === "trial") {
    const ms = trialEndsAt ? new Date(trialEndsAt).getTime() - Date.now() : -1;
    if (ms <= 0) status = "expired";
    else daysLeft = Math.ceil(ms / 86_400_000);
  }
  const active = status === "active" || status === "trial";

  return {
    planId: ((data?.plan_id as PlanId | undefined) ?? "site_bot") as PlanId,
    planName: plan?.name ?? "Sayt + Bot",
    status,
    trialEndsAt,
    daysLeft,
    active,
    allowSites: active && !!plan?.allow_sites,
    allowBots: active && !!plan?.allow_bots,
  };
}

export function formatPrice(price: number | null) {
  if (price === null) return "Narxi tez orada";
  return `${price.toLocaleString("ru-RU").replace(/,/g, " ")} so'm / oy`;
}
