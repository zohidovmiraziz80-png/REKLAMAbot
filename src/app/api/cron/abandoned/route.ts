import { NextResponse } from "next/server";
import { sendAbandonedReminders } from "@/lib/shop/abandoned";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Tashlab ketilgan savat eslatmalari. Har 30 daqiqada chaqiriladi (GitHub Actions / Vercel Cron).
 * Takroriy chaqiruv xavfsiz: har savatga faqat bitta eslatma boradi.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const sent = await sendAbandonedReminders(createAdminClient());
  return NextResponse.json({ ok: true, sent });
}
