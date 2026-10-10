import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { decryptSecret } from "@/lib/crypto";
import { pushOrderToBito } from "@/lib/integrations/bito-sync";
import { assignPayAmount } from "@/lib/payments/card";
import { loadPayConfigs } from "@/lib/payments/config";
import { verifySession } from "@/lib/shop/customer-session";
import { formatMoney } from "@/lib/shop/format";
import { clickCheckoutUrl, multicardCheckoutUrl, paymeCheckoutUrl } from "@/lib/payments/core";
import { getSiteUrl } from "@/lib/supabase/env";
import { normalizeUzPhone } from "@/lib/phone";
import { getWorkspacePlan } from "@/lib/plans";
import { loadOrderRow, notifyNewOrder } from "@/lib/shop/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyChatLink } from "@/lib/telegram/chat-link";
import { verifyInitData, type WebAppUser } from "@/lib/telegram/webapp";

/**
 * Ommaviy saytdan (yoki Telegram Mini App'dan) buyurtma qabul qilish.
 * Narx va qoldiq faqat bazada (create_order funksiyasi) hisoblanadi — brauzerdan kelgan narxga ishonilmaydi.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({
  items: z
    .array(z.object({ id: z.string().uuid(), qty: z.number().int().min(1).max(99) }))
    .min(1, "Savat bo'sh")
    .max(50),
  name: z.string().trim().min(2, "Ismingizni kiriting").max(80),
  phone: z.string().trim().min(5).max(30),
  delivery: z.enum(["pickup", "courier"]),
  address: z.string().trim().max(300).default(""),
  comment: z.string().trim().max(500).default(""),
  initData: z.string().max(4096).default(""),
  tgLink: z.object({ bot: z.string().max(64), chat: z.string().max(64) }).nullable().default(null),
  payment: z.enum(["cash", "card", "payme", "click", "multicard"]).default("cash"),
  session: z.string().max(1200).default(""),
  returnUrl: z.string().max(500).default(""),
});

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function normalizePhone(raw: string): string | null {
  const uz = normalizeUzPhone(raw);
  if (uz) return uz;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15 ? `+${digits}` : null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return fail("Do'kon topilmadi", 404);

  let parsed;
  try {
    parsed = body.safeParse(await request.json());
  } catch {
    return fail("So'rov noto'g'ri");
  }
  if (!parsed.success) {
    const f = parsed.error.flatten();
    return fail(f.formErrors[0] ?? Object.values(f.fieldErrors).flat()[0] ?? "Ma'lumot noto'g'ri");
  }
  const input = parsed.data;

  const phone = normalizePhone(input.phone);
  if (!phone) return fail("Telefon raqamini to'g'ri kiriting, masalan +998 90 123 45 67");
  if (input.delivery === "courier" && input.address.length < 5) return fail("Yetkazish manzilini kiriting");

  let db;
  try {
    db = createAdminClient();
  } catch {
    return fail("Server sozlanmagan", 500);
  }

  const { data: site } = await db.from("published_sites").select("project_id, workspace_id").eq("slug", slug).maybeSingle();
  if (!site) return fail("Do'kon topilmadi", 404);
  const workspaceId = site.workspace_id as string;

  const plan = await getWorkspacePlan(db, workspaceId);
  if (!plan.allowSites) return fail("Do'kon hozircha buyurtma qabul qilmayapti", 403);

  // To'lov usuli: onlayn bo'lsa — shu do'konda ulangan bo'lishi kerak
  const payConfigs = await loadPayConfigs(db, workspaceId);
  const online = input.payment === "payme" || input.payment === "click" || input.payment === "multicard";
  if (online && !payConfigs[input.payment as "payme" | "click" | "multicard"]) return fail("Bu to'lov usuli hozir mavjud emas");
  let { data: cs } = await db.from("shop_settings").select("cash_enabled, card_enabled, card_number, card_holder").eq("workspace_id", workspaceId).maybeSingle();
  if (!cs) {
    // Karta ustunlari hali bazada bo'lmasa
    const legacy = await db.from("shop_settings").select("cash_enabled").eq("workspace_id", workspaceId).maybeSingle();
    cs = legacy.data ? { ...legacy.data, card_enabled: false, card_number: "", card_holder: "" } : null;
  }
  if (input.payment === "cash" && cs && cs.cash_enabled === false) return fail("Iltimos, boshqa to'lov usulini tanlang");
  if (input.payment === "card" && !(cs?.card_enabled && cs.card_number)) return fail("Bu to'lov usuli hozir mavjud emas");

  // Oddiy himoya: bir raqamdan 2 daqiqada 3 tadan ko'p buyurtma bo'lmasin
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { count } = await db
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("phone", phone)
    .gte("created_at", since);
  if ((count ?? 0) >= 3) return fail("Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.", 429);

  // Telegram Mini App: qaysi botdan ochilganini va mijozning chat id'sini aniqlaymiz
  let tgUser: WebAppUser | null = null;
  let botProjectId: string | null = null;
  if (input.initData) {
    const { data: bots } = await db.from("bots").select("project_id, token_encrypted").eq("workspace_id", workspaceId);
    for (const b of bots ?? []) {
      try {
        const u = verifyInitData(input.initData, decryptSecret(b.token_encrypted as string));
        if (u) {
          tgUser = u;
          botProjectId = b.project_id as string;
          break;
        }
      } catch {
        // keyingi botni tekshiramiz
      }
    }
  }

  // Pastki menyu tugmasidan ochilgan Mini App: bot qo'shgan imzolangan parametr
  if (!tgUser && input.tgLink) {
    const chatId = verifyChatLink(input.tgLink.bot, input.tgLink.chat);
    if (chatId) {
      const { data: b } = await db.from("bots").select("project_id").eq("project_id", input.tgLink.bot).eq("workspace_id", workspaceId).maybeSingle();
      if (b) {
        tgUser = { id: chatId };
        botProjectId = b.project_id as string;
      }
    }
  }

  // Saytda Telegram orqali kirgan mijoz: buyurtma holati botga keladi
  if (!tgUser && input.session) {
    const sess = verifySession(input.session, workspaceId);
    if (sess?.b && sess.c) {
      tgUser = { id: sess.c };
      botProjectId = sess.b;
    }
  }

  const { data: created, error } = await db.rpc("create_order", {
    p_workspace: workspaceId,
    p_source: tgUser ? "miniapp" : "site",
    p_site_project: site.project_id,
    p_bot_project: botProjectId,
    p_chat_id: tgUser?.id ?? null,
    p_items: input.items,
    p_name: input.name,
    p_phone: phone,
    p_username: tgUser?.username ?? "",
    p_delivery: input.delivery,
    p_address: input.delivery === "courier" ? input.address : "",
    p_comment: input.comment,
  });

  if (error) {
    const m = error.message ?? "";
    if (m.includes("orders_closed")) return fail("Do'kon hozircha buyurtma qabul qilmayapti");
    if (m.includes("delivery_unavailable")) return fail("Tanlangan yetkazish usuli mavjud emas");
    if (m.includes("product_unavailable")) return fail("Savatdagi ba'zi mahsulotlar sotuvda yo'q. Sahifani yangilang.", 409);
    const stock = m.match(/out_of_stock:(.+)/);
    if (stock) return fail(`"${stock[1].trim()}" yetarli emas. Miqdorni kamaytiring.`, 409);
    const min = m.match(/min_order:(\d+)/);
    if (min) return fail(`Minimal buyurtma: ${Number(min[1]).toLocaleString("ru-RU").replace(/,/g, " ")} so'm`);
    if (m.includes("empty_cart")) return fail("Savat bo'sh");
    console.error("create_order xatosi:", m);
    return fail("Buyurtma saqlanmadi. Qayta urinib ko'ring.", 500);
  }

  const result = created as { id: string; number: number; total: number };
  if (input.payment !== "cash") await db.from("orders").update({ payment_method: input.payment }).eq("id", result.id);

  // Kartaga o'tkazma: noyob summa (kanalga tushgan SMS shu summa bo'yicha topiladi)
  let card: { number: string; holder: string; amount: number } | null = null;
  if (input.payment === "card" && cs) {
    const amount = await assignPayAmount(db, workspaceId, result.id, Number(result.total));
    card = { number: cs.card_number as string, holder: (cs.card_holder as string) || "", amount };
  }

  // Onlayn to'lov havolasi
  let payUrl: string | null = null;
  let payError: string | null = null;
  if (online) {
    // To'lovdan keyin mijoz qaytadigan sahifa: buyurtma berilgan sahifaning o'zi (o'z domeni ham ishlaydi)
    const origin = request.headers.get("origin") || getSiteUrl();
    let ret = `${origin.replace(/\/$/, "")}/s/${slug}?order=${result.number}`;
    try {
      const u = new URL(input.returnUrl);
      if (u.protocol === "https:" && u.origin === origin) ret = `${u.origin}${u.pathname}?order=${result.number}`;
    } catch {
      // standart manzil qoladi
    }
    try {
      if (input.payment === "payme" && payConfigs.payme) payUrl = paymeCheckoutUrl(payConfigs.payme, result.id, Number(result.total), ret);
      else if (input.payment === "click" && payConfigs.click) payUrl = clickCheckoutUrl(payConfigs.click, result.id, Number(result.total), ret);
      else if (input.payment === "multicard" && payConfigs.multicard)
        payUrl = await multicardCheckoutUrl(
          db,
          payConfigs.multicard,
          { id: result.id, workspace_id: workspaceId, number: result.number, total: Number(result.total) },
          ret,
          `${getSiteUrl()}/api/pay/multicard/${workspaceId}`,
        );
    } catch (err) {
      payError = err instanceof Error ? err.message : "To'lov havolasi yaratilmadi";
      console.error("To'lov havolasi xatosi:", payError);
    }
  }

  // Telegram xabarlari (javobni kechiktirmaslik uchun xatolar yutiladi)
  const [{ data: order }, { data: settings }] = await Promise.all([
    loadOrderRow(db, result.id).then((data) => ({ data })),
    db.from("shop_settings").select("order_thanks").eq("workspace_id", workspaceId).maybeSingle(),
  ]);
  const cardText = card
    ? `💳 To'lov: ${card.number}${card.holder ? ` (${card.holder})` : ""} kartasiga aynan ${formatMoney(card.amount)} o'tkazing — to'lov avtomatik tasdiqlanadi.`
    : undefined;
  if (order) await notifyNewOrder(db, order, (settings?.order_thanks as string) || undefined, cardText);

  // Bito ulangan bo'lsa — javobdan keyin fonda sotuv buyurtmasi yaratiladi
  after(async () => {
    try {
      await pushOrderToBito(db, result.id);
    } catch (err) {
      console.error("Bito'ga yuborilmadi:", err instanceof Error ? err.message : "noma'lum");
    }
  });

  return NextResponse.json({
    ok: true,
    orderId: result.id,
    card,
    number: result.number,
    total: result.total,
    telegram: !!tgUser,
    payUrl,
    payError: payError ? "Onlayn to'lov havolasini ochib bo'lmadi. Buyurtma qabul qilindi — siz bilan bog'lanamiz." : null,
  });
}
