"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/env";
import { clearPendingAuth, getPendingAuth, setPendingAuth } from "@/lib/pending-auth";
import { normalizeUzPhone } from "@/lib/phone";

export type AuthFormState = { error?: string; message?: string };

const email = z.string().trim().toLowerCase().email("Email noto'g'ri");
const password = z.string().min(8, "Parol kamida 8 belgidan iborat bo'lishi kerak").max(72);
const otpCode = z
  .string()
  .trim()
  .regex(/^\d{6,10}$/, "Kod faqat raqamlardan iborat (emaildagi kodni kiriting)");

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Ma'lumot noto'g'ri";
}

function isRateLimited(message: string) {
  const m = message.toLowerCase();
  return m.includes("rate limit") || m.includes("security purposes") || m.includes("too many");
}

// ===== Kirish =====

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({ email, password: z.string().min(1, "Parolni kiriting") })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      // Email tasdiqlanmagan — yangi kod yuborib, kod sahifasiga o'tkazamiz
      await supabase.auth.resend({ type: "signup", email: parsed.data.email });
      await setPendingAuth({ email: parsed.data.email, purpose: "signup" });
      redirect("/verify");
    }
    return { error: "Email yoki parol noto'g'ri" };
  }

  redirect(safeNext(formData.get("next")));
}

// ===== Ro'yxatdan o'tish (email + telefon) =====

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({
      fullName: z.string().trim().min(2, "Ismingizni kiriting").max(80),
      phone: z
        .string()
        .transform((v, ctx) => {
          const normalized = normalizeUzPhone(v);
          if (!normalized) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Telefon raqami noto'g'ri. Masalan: +998 90 123 45 67" });
            return z.NEVER;
          }
          return normalized;
        }),
      email,
      password,
    })
    .safeParse({
      fullName: formData.get("fullName"),
      phone: formData.get("phone") ?? "",
      email: formData.get("email"),
      password: formData.get("password"),
    });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, phone: parsed.data.phone },
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Bu email bilan akkaunt allaqachon mavjud. Kirish sahifasidan foydalaning." };
    }
    if (isRateLimited(error.message)) {
      return { error: "Juda ko'p urinish bo'ldi. Bir necha daqiqadan keyin qayta urinib ko'ring." };
    }
    return { error: "Ro'yxatdan o'tib bo'lmadi. Keyinroq qayta urinib ko'ring." };
  }

  // Email allaqachon ro'yxatdan o'tgan bo'lsa Supabase xato bermaydi, lekin identities bo'sh bo'ladi
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { error: "Bu email bilan akkaunt allaqachon mavjud. Kirish sahifasidan foydalaning." };
  }

  // Email tasdiqlash o'chirilgan bo'lsa, sessiya darhol beriladi
  if (data.session) redirect("/dashboard");

  await setPendingAuth({ email: parsed.data.email, purpose: "signup" });
  redirect("/verify");
}

export async function verifySignupCode(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const pending = await getPendingAuth("signup");
  if (!pending) return { error: "Sessiya eskirgan. Qaytadan ro'yxatdan o'ting yoki tizimga kiring." };

  const parsed = otpCode.safeParse(formData.get("code"));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: pending.email, token: parsed.data, type: "email" });
  if (error) return { error: "Kod noto'g'ri yoki muddati o'tgan. Yangi kod so'rang." };

  await clearPendingAuth();
  redirect("/dashboard");
}

export async function resendSignupCode(_prev: AuthFormState, _formData: FormData): Promise<AuthFormState> {
  void _formData;
  const pending = await getPendingAuth("signup");
  if (!pending) return { error: "Sessiya eskirgan. Qaytadan ro'yxatdan o'ting." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email: pending.email });
  if (error) {
    return {
      error: isRateLimited(error.message)
        ? "Kodni qayta yuborish uchun biroz kuting (taxminan 1 daqiqa)."
        : "Kod yuborilmadi. Keyinroq qayta urinib ko'ring.",
    };
  }
  return { message: "Yangi kod emailingizga yuborildi." };
}

// ===== Parolni tiklash (kod orqali) =====

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/reset-password`,
  });
  if (error && isRateLimited(error.message)) {
    return { error: "Juda ko'p urinish bo'ldi. Bir necha daqiqadan keyin qayta urinib ko'ring." };
  }

  // Akkaunt bor-yo'qligini oshkor qilmaslik uchun har doim kod sahifasiga o'tamiz
  await setPendingAuth({ email: parsed.data, purpose: "recovery" });
  redirect("/reset-password");
}

export async function resetPasswordWithCode(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const pending = await getPendingAuth("recovery");
  if (!pending) return { error: "Sessiya eskirgan. Parolni tiklashni qaytadan so'rang." };

  const parsed = z
    .object({ code: otpCode, password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Parollar mos emas" })
    .safeParse({
      code: formData.get("code"),
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    email: pending.email,
    token: parsed.data.code,
    type: "recovery",
  });
  if (verifyError) return { error: "Kod noto'g'ri yoki muddati o'tgan. Yangi kod so'rang." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Parol yangilanmadi. Boshqa parol kiritib ko'ring." };

  await clearPendingAuth();
  redirect("/dashboard");
}

/** Havola orqali kelgan (eski xat) foydalanuvchi uchun: sessiya bor, faqat yangi parol */
export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Parollar mos emas" })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessiya topilmadi. Parolni tiklashni qaytadan so'rang." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Parol yangilanmadi. Boshqa parol kiritib ko'ring." };

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
