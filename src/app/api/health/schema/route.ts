import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Oxirgi migratsiyalar bazada qo'llanganini tekshirish (faqat ha/yo'q, ma'lumot qaytarmaydi) */
export const dynamic = "force-dynamic";

export async function GET() {
  const db = createAdminClient();
  const [a, b, c] = await Promise.all([
    db.from("shop_settings").select("card_enabled").limit(1),
    db.from("chat_messages").select("id").limit(1),
    db.from("orders").select("pay_amount").limit(1),
  ]);
  const { error: d } = await db.from("promo_codes").select("id").limit(1);
  return NextResponse.json({ cardColumns: !a.error, chat: !b.error, payAmount: !c.error, promoCodes: !d });
}
