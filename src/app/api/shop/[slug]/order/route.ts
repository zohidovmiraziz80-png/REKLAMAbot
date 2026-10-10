import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { decryptSecret } from "@/lib/crypto";
import { normalizeUzPhone } from "@/lib/phone";
import { getWorkspacePlan } from "@/lib/plans";
import { ORDER_COLUMNS, notifyNewOrder, type OrderRow } from "@/lib/shop/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyChatLink } from "@/lib/telegram/chat-link";
import { verifyInitData, type WebAppUser } from "@/lib/telegram/webapp";

/**
 * Ommaviy saytdan (yoki Telegram Mini App'dan) buyurtma qabul qilish.
 * Narx va qoldiq faqat bazada (create_order funksiyasi) hisoblanadi — brauzerdan kelgan narxga ishonilmaydi.
 */

export const dynamic = "force-dynamic";

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

  // Telegram xabarlari (javobni kechiktirmaslik uchun xatolar yutiladi)
  const [{ data: order }, { data: settings }] = await Promise.all([
    db.from("orders").select(ORDER_COLUMNS).eq("id", result.id).maybeSingle(),
    db.from("shop_settings").select("order_thanks").eq("workspace_id", workspaceId).maybeSingle(),
  ]);
  if (order) await notifyNewOrder(db, order as OrderRow, (settings?.order_thanks as string) || undefined);

  return NextResponse.json({ ok: true, number: result.number, total: result.total, telegram: !!tgUser });
}
