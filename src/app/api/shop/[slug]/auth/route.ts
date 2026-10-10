import { NextResponse, type NextRequest } from "next/server";
import { createSession, newLoginToken } from "@/lib/shop/customer-session";
import { siteBySlug } from "@/lib/shop/site-lookup";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Mijozning saytga kirishi (Telegram orqali telefon tasdiqlash):
 *  POST → bir martalik kod va bot havolasi (t.me/<bot>?start=login_<kod>)
 *  GET ?token= → holat; tasdiqlangan bo'lsa sessiya tokeni qaytadi
 */

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = createAdminClient();
  const site = await siteBySlug(db, slug);
  if (!site) return fail("Do'kon topilmadi", 404);

  const { data: bots } = await db.from("bots").select("project_id, username, owner_chat_id, status").eq("workspace_id", site.workspaceId).order("created_at");
  const bot = (bots ?? []).find((b) => b.status === "active" && b.owner_chat_id) ?? (bots ?? []).find((b) => b.status === "active") ?? bots?.[0];
  if (!bot) return fail("Bu do'konda hali Telegram bot ulanmagan", 409);

  const since = new Date(Date.now() - 60 * 1000).toISOString();
  const { count } = await db.from("customer_logins").select("token", { count: "exact", head: true }).eq("workspace_id", site.workspaceId).gte("created_at", since);
  if ((count ?? 0) > 60) return fail("Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.", 429);

  const token = newLoginToken();
  const { error } = await db.from("customer_logins").insert({ token, workspace_id: site.workspaceId, bot_project_id: bot.project_id });
  if (error) return fail("Xatolik. Qayta urinib ko'ring.", 500);
  return NextResponse.json({ ok: true, token, url: `https://t.me/${bot.username}?start=login_${token}` });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!/^[a-f0-9]{24}$/.test(token)) return fail("Kod noto'g'ri");
  const db = createAdminClient();
  const site = await siteBySlug(db, slug);
  if (!site) return fail("Do'kon topilmadi", 404);

  const { data: row } = await db
    .from("customer_logins")
    .select("status, phone, chat_id, name, bot_project_id, expires_at")
    .eq("token", token)
    .eq("workspace_id", site.workspaceId)
    .maybeSingle();
  if (!row) return fail("Kod topilmadi", 404);
  if (row.status === "pending") {
    const expired = new Date(row.expires_at as string).getTime() < Date.now();
    return NextResponse.json({ ok: true, status: expired ? "expired" : "pending" });
  }
  if (row.status !== "confirmed") return NextResponse.json({ ok: true, status: "expired" });

  // Bir marta ishlatiladi
  const { data: used } = await db.from("customer_logins").update({ status: "used" }).eq("token", token).eq("status", "confirmed").select("token").maybeSingle();
  if (!used) return NextResponse.json({ ok: true, status: "expired" });

  const customer = { name: (row.name as string | null) ?? "", phone: row.phone as string };
  const session = createSession({
    w: site.workspaceId,
    p: customer.phone,
    c: Number(row.chat_id),
    b: (row.bot_project_id as string | null) ?? null,
    n: customer.name,
  });
  return NextResponse.json({ ok: true, status: "confirmed", session, customer });
}
