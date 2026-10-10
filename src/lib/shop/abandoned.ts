import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/crypto";
import { tg } from "@/lib/telegram/api";
import { withChatLink } from "@/lib/telegram/chat-link";
import { botConfigSchema, safeWebAppUrl } from "@/lib/telegram/config";
import { shopUrl } from "@/lib/telegram/main-bot";
import { formatMoney } from "./format";

/**
 * Tashlab ketilgan savat: savatga qo'shib buyurtma bermagan Telegram mijoziga N soatdan keyin bitta eslatma.
 * Muntazam chaqiriladi (/api/cron/abandoned).
 */

type Cart = { items: { id: string; qty: number }[]; slug: string; at: number; reminded?: boolean };

export async function sendAbandonedReminders(db: SupabaseClient) {
  const { data: bots } = await db.from("bots").select("project_id, workspace_id, token_encrypted, config");
  let sent = 0;
  for (const b of bots ?? []) {
    const cfg = botConfigSchema.parse(b.config ?? {});
    if (!cfg.abandonEnabled) continue;
    const cutoff = Date.now() - cfg.abandonHours * 3600_000;
    const { data: subs } = await db
      .from("bot_subscribers")
      .select("chat_id, first_name, state")
      .eq("project_id", b.project_id)
      .not("state->cart", "is", null)
      .limit(300);
    const due = (subs ?? []).filter((s) => {
      const c = (s.state as { cart?: Cart } | null)?.cart;
      // 3 kundan eski savatga eslatma yubormaymiz
      return c && !c.reminded && c.at < cutoff && c.at > Date.now() - 3 * 86_400_000 && c.items?.length;
    });
    if (!due.length) continue;
    let token: string;
    try {
      token = decryptSecret(b.token_encrypted as string);
    } catch {
      continue;
    }
    const allIds = [...new Set(due.flatMap((s) => ((s.state as { cart: Cart }).cart.items ?? []).map((i) => i.id)))];
    const { data: products } = await db.from("products").select("id, name, price, is_active").in("id", allIds.slice(0, 500));
    const byId = new Map((products ?? []).map((p) => [p.id as string, p]));
    const base = cfg.siteUrl || (await shopUrl(db, b.workspace_id as string, cfg)) || "";

    for (const s of due) {
      const state = s.state as { cart: Cart } & Record<string, unknown>;
      const lines = state.cart.items
        .map((i) => ({ p: byId.get(i.id), qty: i.qty }))
        .filter((x) => x.p && x.p.is_active)
        .slice(0, 8);
      if (lines.length) {
        const total = lines.reduce((sum, x) => sum + Number(x.p!.price) * x.qty, 0);
        const text = [
          `🛒 ${s.first_name ? `${s.first_name}, s` : "S"}avatingizda mahsulotlar qoldi:`,
          "",
          ...lines.map((x) => `• ${x.p!.name} × ${x.qty}`),
          "",
          `💰 Jami: ${formatMoney(total)}`,
          cfg.abandonText ? `\n${cfg.abandonText}` : "",
          "\nBuyurtmani yakunlash uchun pastdagi tugmani bosing 👇",
        ]
          .filter((l) => l !== undefined)
          .join("\n");
        const webapp = safeWebAppUrl(base);
        let url: string | null = webapp;
        if (webapp) {
          try {
            url = withChatLink(webapp, b.project_id as string, Number(s.chat_id));
          } catch {
            url = webapp;
          }
        }
        try {
          await tg(token, "sendMessage", {
            chat_id: s.chat_id,
            text: text.slice(0, 4000),
            ...(url ? { reply_markup: { inline_keyboard: [[{ text: "🛍 Buyurtmani yakunlash", web_app: { url } }]] } } : {}),
          });
          sent++;
        } catch {
          // mijoz botni bloklagan
        }
      }
      await db
        .from("bot_subscribers")
        .update({ state: { ...state, cart: { ...state.cart, reminded: true } } })
        .eq("project_id", b.project_id)
        .eq("chat_id", s.chat_id);
    }
  }
  return sent;
}
