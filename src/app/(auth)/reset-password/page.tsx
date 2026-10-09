import type { Metadata } from "next";
import Link from "next/link";
import { getPendingAuth, maskEmail } from "@/lib/pending-auth";
import { createClient } from "@/lib/supabase/server";
import { ResetForm, ResetWithCodeForm } from "./reset-form";

export const metadata: Metadata = { title: "Yangi parol" };

export default async function ResetPasswordPage() {
  const pending = await getPendingAuth("recovery");

  if (pending) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Yangi parol</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          Agar <span className="font-medium text-ink">{maskEmail(pending.email)}</span> ro&apos;yxatdan o&apos;tgan
          bo&apos;lsa, unga kod yuborildi. Kodni va yangi parolni kiriting.
        </p>
        <ResetWithCodeForm />
        <p className="mt-5 text-center text-sm text-muted">
          Kod kelmadimi?{" "}
          <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline">
            Qayta so&apos;rash
          </Link>
        </p>
      </>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Yangi parol</h1>
        <p className="mt-1 mb-6 text-sm text-muted">Akkauntingiz uchun yangi parol o&apos;rnating</p>
        <ResetForm />
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sessiya eskirgan</h1>
      <p className="mt-2 text-sm text-muted">Parolni tiklashni qaytadan so&apos;rang.</p>
      <Link
        href="/forgot-password"
        className="mt-6 block rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
      >
        Parolni tiklash
      </Link>
    </>
  );
}
