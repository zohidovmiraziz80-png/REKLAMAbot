"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DomainApiError, checkProjectDomain, removeProjectDomain } from "@/lib/vercel/domains";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  return isAdmin === true ? { supabase, user } : null;
}

export async function adminRecheckDomain(domain: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };
  try {
    const status = await checkProjectDomain(domain);
    const state = status.verified && status.configured ? "active" : "pending";
    await admin.supabase
      .from("site_domains")
      .update({ status: state, verification: status.records, last_error: state === "active" ? null : "DNS hali sozlanmagan" })
      .eq("domain", domain);
  } catch (err) {
    const message = err instanceof DomainApiError ? err.message : "Xato";
    await admin.supabase.from("site_domains").update({ status: "error", last_error: message }).eq("domain", domain);
    return { ok: false, error: message };
  } finally {
    revalidatePath("/admin/domains");
  }
  return { ok: true };
}

export async function adminRemoveDomain(domain: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };
  try {
    await removeProjectDomain(domain);
  } catch (err) {
    if (!(err instanceof DomainApiError && err.code === "not_configured")) {
      return { ok: false, error: err instanceof Error ? err.message : "Xato" };
    }
  }
  const { error } = await admin.supabase.from("site_domains").delete().eq("domain", domain);
  if (error) return { ok: false, error: "O'chirilmadi" };
  revalidatePath("/admin/domains");
  return { ok: true };
}
