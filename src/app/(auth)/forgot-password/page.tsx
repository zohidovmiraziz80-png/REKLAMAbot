import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Parolni tiklash" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Parolni tiklash</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Emailingizni kiriting, tiklash havolasini yuboramiz</p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Kirish sahifasiga qaytish
        </Link>
      </p>
    </>
  );
}
