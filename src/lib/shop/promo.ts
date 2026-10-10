import type { SupabaseClient } from "@supabase/supabase-js";

export type PromoRow = {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  min_order: number;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
};

export const normalizeCode = (raw: string) => raw.trim().toUpperCase().replace(/\s+/g, "");

/** Promo-kodni tekshiradi va chegirma summasini hisoblaydi */
export async function evaluatePromo(
  db: SupabaseClient,
  workspaceId: string,
  rawCode: string,
  subtotal: number,
): Promise<{ ok: true; promo: PromoRow; discount: number; label: string } | { ok: false; error: string }> {
  const code = normalizeCode(rawCode);
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return { ok: false, error: "Promo-kod noto'g'ri" };
  const { data, error } = await db
    .from("promo_codes")
    .select("id, code, kind, value, min_order, max_uses, used_count, active, expires_at")
    .eq("workspace_id", workspaceId)
    .eq("code", code)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Bunday promo-kod yo'q" };
  const p = data as PromoRow;
  if (!p.active) return { ok: false, error: "Promo-kod faol emas" };
  if (p.expires_at && new Date(p.expires_at).getTime() < Date.now()) return { ok: false, error: "Promo-kod muddati tugagan" };
  if (p.max_uses && p.used_count >= p.max_uses) return { ok: false, error: "Promo-kod limiti tugagan" };
  if (subtotal < Number(p.min_order)) return { ok: false, error: `Promo-kod ${Number(p.min_order).toLocaleString("ru-RU").replace(/,/g, " ")} so'mdan ortiq xaridga amal qiladi` };
  const discount = p.kind === "percent" ? Math.round((subtotal * Math.min(100, Number(p.value))) / 100) : Math.min(Number(p.value), subtotal);
  const label = p.kind === "percent" ? `-${p.value}%` : `-${Number(p.value).toLocaleString("ru-RU").replace(/,/g, " ")} so'm`;
  return { ok: true, promo: p, discount, label };
}
