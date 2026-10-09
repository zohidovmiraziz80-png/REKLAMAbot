import type { Metadata } from "next";
import Link from "next/link";
import { getPendingAuth, maskEmail } from "@/lib/pending-auth";
import { ResendCodeForm, VerifyCodeForm } from "./verify-forms";

export const metadata: Metadata = { title: "Emailni tasdiqlash" };

export default async function VerifyPage() {
  const pending = await getPendingAuth("signup");

  if (!pending) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Sessiya eskirgan</h1>
        <p className="mt-2 text-sm text-muted">Tasdiqlash uchun qaytadan tizimga kiring yoki ro&apos;yxatdan o&apos;ting.</p>
        <div className="mt-6 flex gap-3">
          <Link href="/login" className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700">
            Kirish
          </Link>
          <Link href="/register" className="flex-1 rounded-lg border border-line px-4 py-2.5 text-center text-sm font-semibold hover:border-brand-500">
            Ro&apos;yxatdan o&apos;tish
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Emailni tasdiqlang</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        <span className="font-medium text-ink">{maskEmail(pending.email)}</span> manziliga tasdiqlash xati yuborildi.
        Xatdagi kodni quyida kiriting yoki xatdagi tasdiqlash tugmasini bosing.
      </p>
      <VerifyCodeForm />
      <ResendCodeForm />
    </>
  );
}
