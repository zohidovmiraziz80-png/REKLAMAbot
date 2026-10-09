import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clearPendingAuth } from "@/lib/pending-auth";

/**
 * Emaildagi tugma shu yerga keladi: ?token_hash=...&type=email|recovery
 * PKCE'dan farqli o'laroq, boshqa qurilmada (masalan telefonda) ochilsa ham ishlaydi.
 */
const ALLOWED: EmailOtpType[] = ["email", "signup", "recovery", "email_change", "invite", "magiclink"];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const isRecovery = type === "recovery";
  const failUrl = `${origin}${isRecovery ? "/forgot-password" : "/login"}?error=link`;

  if (!tokenHash || !type || !ALLOWED.includes(type)) return NextResponse.redirect(failUrl);

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return NextResponse.redirect(failUrl);

  await clearPendingAuth();
  return NextResponse.redirect(`${origin}${isRecovery ? "/reset-password" : "/dashboard"}`);
}
