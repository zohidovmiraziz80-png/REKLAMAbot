import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * Service role klienti — RLS'ni chetlab o'tadi.
 * FAQAT serverda va foydalanuvchi huquqi oldindan tekshirilgandan keyin
 * (yoki Telegram webhook kabi sessiyasiz, maxfiy kalit bilan tekshirilgan joylarda) ishlatiladi.
 */
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY o'rnatilmagan");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
