import type { SupabaseClient } from "@supabase/supabase-js";
import { publicSiteUrls } from "@/lib/site/hosting";
import { callClaudeText } from "./claude";

/**
 * Do'kon AI yordamchisi: mijoz savoliga do'kon katalogi va sozlamalari asosida javob beradi.
 * Telegram bot va saytdagi chat oynasi uchun umumiy.
 */

type Turn = { role: "user" | "assistant"; content: string };

const STOP = new Set(["bormi", "qancha", "narxi", "narx", "kerak", "menga", "bor", "yoq", "есть", "сколько", "цена", "нужно", "hello", "salom", "assalomu", "alaykum"]);

function words(q: string) {
  return [
    ...new Set(
      q
        .toLowerCase()
        .replace(/[^a-zа-яёўқғҳ0-9'\s-]/gi, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOP.has(w)),
    ),
  ].slice(0, 6);
}

async function catalog(db: SupabaseClient, workspaceId: string, query: string) {
  const ws = words(query);
  const base = () => db.from("products").select("name, price, old_price, category, stock, description").eq("workspace_id", workspaceId).eq("is_active", true);
  let rows: Record<string, unknown>[] = [];
  if (ws.length) {
    const or = ws.flatMap((w) => [`name.ilike.%${w.replace(/[%,()]/g, "")}%`, `category.ilike.%${w.replace(/[%,()]/g, "")}%`]).join(",");
    const { data } = await base().or(or).limit(15);
    rows = data ?? [];
  }
  if (rows.length < 5) {
    const { data } = await base().order("sort").limit(12);
    const seen = new Set(rows.map((r) => r.name));
    rows = [...rows, ...(data ?? []).filter((r) => !seen.has(r.name))].slice(0, 15);
  }
  const { data: cats } = await db.from("products").select("category").eq("workspace_id", workspaceId).eq("is_active", true).neq("category", "").limit(1000);
  const categories = [...new Set((cats ?? []).map((c) => c.category as string))].slice(0, 30);
  return { rows, categories };
}

const money = (n: unknown) => `${Number(n).toLocaleString("ru-RU").replace(/,/g, " ")} so'm`;

export async function answerCustomer(
  db: SupabaseClient,
  workspaceId: string,
  opts: { history: Turn[]; question: string; channel: "telegram" | "site"; instructions?: string; siteSlug?: string },
): Promise<string> {
  const [{ rows, categories }, { data: s }, { data: ws }, { data: pub }] = await Promise.all([
    catalog(db, workspaceId, opts.question),
    db.from("shop_settings").select("pickup_enabled, pickup_address, delivery_enabled, delivery_price, free_delivery_from, min_order").eq("workspace_id", workspaceId).maybeSingle(),
    db.from("workspaces").select("name").eq("id", workspaceId).maybeSingle(),
    db.from("published_sites").select("slug").eq("workspace_id", workspaceId).limit(1).maybeSingle(),
  ]);
  const slug = opts.siteSlug ?? (pub?.slug as string | undefined);
  const site = slug ? (publicSiteUrls(slug).subdomainUrl ?? publicSiteUrls(slug).pathUrl) : null;

  const products = rows
    .map(
      (r) =>
        `- ${r.name} — ${money(r.price)}${r.old_price ? ` (avval ${money(r.old_price)})` : ""}${r.category ? ` [${r.category}]` : ""}${r.stock === 0 ? " — TUGAGAN" : ""}${
          r.description ? `: ${String(r.description).slice(0, 120)}` : ""
        }`,
    )
    .join("\n");

  const delivery = [
    s?.pickup_enabled !== false ? `Olib ketish: bor${s?.pickup_address ? ` (${s.pickup_address})` : ""}` : "Olib ketish: yo'q",
    s?.delivery_enabled !== false
      ? `Yetkazib berish: ${Number(s?.delivery_price ?? 0) ? money(s?.delivery_price) : "bepul"}${s?.free_delivery_from ? `, ${money(s.free_delivery_from)} dan bepul` : ""}`
      : "Yetkazib berish: yo'q",
    Number(s?.min_order ?? 0) ? `Minimal buyurtma: ${money(s?.min_order)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system = `Sen "${(ws?.name as string) || "do'kon"}" internet-do'konining yordamchisisan. Mijoz bilan ${opts.channel === "telegram" ? "Telegram botda" : "saytdagi chatda"} gaplashyapsan.
Qoidalar:
- Mijoz qaysi tilda yozsa (o'zbek lotin/kirill yoki rus), shu tilda javob ber. Qisqa, samimiy, 1–5 gap. Markdown ishlatma.
- Faqat quyidagi ro'yxatdagi mahsulotlar va narxlarni ayt. Ro'yxatda yo'q narsani o'ylab topma — "aniq ma'lumot uchun operator javob beradi" de.
- Mos mahsulot bo'lsa 1–3 tasini narxi bilan taklif qil.
- Buyurtma berish: ${opts.channel === "telegram" ? `botdagi «Do'kon» tugmasi${site ? ` yoki sayt: ${site}` : ""}` : "shu saytda savatga qo'shib rasmiylashtirish"}.
- To'lov, chegirma va'da qilma; shaxsiy ma'lumot so'rama.

Do'kon ma'lumotlari:
${delivery}
${categories.length ? `Bo'limlar: ${categories.join(", ")}` : ""}
${opts.instructions ? `\nEgasining qo'shimcha ko'rsatmalari:\n${opts.instructions}` : ""}

Mos keladigan mahsulotlar:
${products || "(katalog bo'sh)"}`;

  const history = opts.history.slice(-8).filter((t) => t.content.trim());
  // Anthropic: suhbat user bilan boshlanishi va navbatma-navbat bo'lishi kerak
  const merged: Turn[] = [];
  for (const t of [...history, { role: "user" as const, content: opts.question }]) {
    const last = merged[merged.length - 1];
    if (last && last.role === t.role) last.content += `\n${t.content}`;
    else merged.push({ ...t });
  }
  while (merged[0]?.role === "assistant") merged.shift();
  return callClaudeText({ system, messages: merged.map((t) => ({ ...t, content: t.content.slice(0, 2000) })) });
}
