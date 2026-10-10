import { NextResponse, type NextRequest } from "next/server";
import { createSession, newLoginToken } from "@/lib/shop/customer-session";
import { siteBySlug } from "@/lib/shop/site-lookup";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Mijozning saytga kirishi (Telegram orqali telefon tasdiqlash):
 *  POST → bir martalik kod va do'konning asosiy boti havolasi (t.me/<bot>?start=login_<kod>)
 *  GET ?token= → holat; bot raqamni tasdiqlagan bo'lsa sessiya tokeni qaytadi.
 * Tasdiq bot obunachisining holatida (bot_subscribers.state.login) saqlanadi — alohida jadval kerak emas.
 */

export const dynamic = "force-dynamic";

const LOGIN_TTL_MS = 15 * 60 * 1000;
const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = createAdminClient();
  const site = await siteBySlug(db, slug);
  if (!site) return fail("Do'kon topilmadi", 404);

  const { data: bots } = await db.from("bots").select("project_id, username, owner_chat_id, status, config").eq("workspace_id", site.workspaceId).order("created_at");
  const list = (bots ?? []).filter((b) => b.status !== "error");
  // Asosiy bot: Mini App sifatida aynan shu saytni ochadigan bot, bo'lmasa egasi ulangan bot, bo'lmasa birinchisi
  const opensThisSite = (b: { config: unknown }) => {
    const url = String((b.config as { siteUrl?: string } | null)?.siteUrl ?? "");
    return url.includes(`/s/${slug}`) || url.includes(`//${slug}.`);
  };
  const bot = list.find(opensThisSite) ?? list.find((b) => b.owner_chat_id) ?? list[0] ?? bots?.[0];
  if (!bot) return fail("Bu do'konda hali Telegram bot ulanmagan", 409);

  const token = newLoginToken();
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
    .from("bot_subscribers")
    .select("project_id, chat_id, first_name, state")
    .eq("workspace_id", site.workspaceId)
    .eq("state->login->>n", token)
    .maybeSingle();
  if (!row) return NextResponse.json({ ok: true, status: "pending" });

  const login = (row.state as { login?: { n: string; phone: string; name?: string; at: number } } | null)?.login;
  // Bir marta ishlatiladi
  await db.from("bot_subscribers").update({ state: {} }).eq("project_id", row.project_id).eq("chat_id", row.chat_id).eq("state->login->>n", token);
  if (!login?.phone || Date.now() - Number(login.at) > LOGIN_TTL_MS) return NextResponse.json({ ok: true, status: "expired" });

  const customer = { name: login.name || (row.first_name as string | null) || "", phone: login.phone };
  const session = createSession({ w: site.workspaceId, p: customer.phone, c: Number(row.chat_id), b: row.project_id as string, n: customer.name });
  return NextResponse.json({ ok: true, status: "confirmed", session, customer });
}
