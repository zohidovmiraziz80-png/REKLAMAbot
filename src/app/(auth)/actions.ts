"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/env";

export type AuthFormState = { error?: string; message?: string };

const email = z.string().trim().toLowerCase().email("Email noto'g'ri");
const password = z.string().min(8, "Parol kamida 8 belgidan iborat bo'lishi kerak").max(72);

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Ma'lumot noto'g'ri";
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({ email, password: z.string().min(1, "Parolni kiriting") })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return { error: "Email hali tasdiqlanmagan. Pochtangizdagi havolani bosing." };
    }
    return { error: "Email yoki parol noto'g'ri" };
  }

  redirect(safeNext(formData.get("next")));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({
      fullName: z.string().trim().min(2, "Ismingizni kiriting").max(80),
      email,
      password,
    })
    .safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Bu email bilan akkaunt allaqachon mavjud" };
    }
    return { error: "Ro'yxatdan o'tib bo'lmadi. Keyinroq qayta urinib ko'ring." };
  }

  // Email tasdiqlash o'chirilgan bo'lsa, sessiya darhol beriladi
  if (data.session) redirect("/dashboard");

  return { message: "Emailingizga tasdiqlash havolasi yuborildi. Uni bosib, akkauntni faollashtiring." };
}

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/reset-password`,
  });

  // Akkaunt bor-yo'qligini oshkor qilmaslik uchun javob har doim bir xil
  return { message: "Agar bu email ro'yxatdan o'tgan bo'lsa, parolni tiklash havolasi yuborildi." };
}

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
  if (!user) return { error: "Havola eskirgan. Parolni tiklashni qaytadan so'rang." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Parol yangilanmadi. Boshqa parol kiritib ko'ring." };

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
