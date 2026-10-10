import { NextResponse, type NextRequest } from "next/server";
import { decryptSecret, safeEqual } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleUpdate, type TgUpdate } from "@/lib/telegram/handler";

/**
 * Telegram webhook: https://<platforma>/api/telegram/<projectId>
 * So'rov X-Telegram-Bot-Api-Secret-Token sarlavhasi bilan tekshiriladi.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(botId)) return new NextResponse(null, { status: 404 });

  const secret = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secret) return new NextResponse(null, { status: 401 });

  let db;
  try {
    db = createAdminClient();
  } catch {
    return new NextResponse(null, { status: 500 });
  }

  const { data: row } = await db
    .from("bots")
    .select("project_id, workspace_id, owner_link_code, owner_chat_id, config, token_encrypted, webhook_secret")
    .eq("project_id", botId)
    .maybeSingle();

  if (!row || !safeEqual(secret, row.webhook_secret as string)) return new NextResponse(null, { status: 401 });

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    const token = decryptSecret(row.token_encrypted as string);
    await handleUpdate(
      db,
      {
        project_id: row.project_id as string,
        workspace_id: row.workspace_id as string,
        owner_link_code: row.owner_link_code as string,
        owner_chat_id: (row.owner_chat_id as number | null) ?? null,
        config: row.config,
        token,
      },
      update,
    );
  } catch (err) {
    // Telegram qayta yubormasligi uchun baribir 200 qaytaramiz
    console.error("Telegram update xatosi:", err instanceof Error ? err.message : "noma'lum");
  }

  return NextResponse.json({ ok: true });
}
