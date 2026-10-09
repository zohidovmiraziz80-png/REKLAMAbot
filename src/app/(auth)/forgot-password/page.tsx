import type { Metadata } from "next";
import Link from "next/link";
import { FormAlert } from "@/components/ui";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Parolni tiklash" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Parolni tiklash</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Emailingizni kiriting, tiklash kodini yuboramiz</p>
      {error === "link" && (
        <div className="mb-4">
          <FormAlert error="Havola eskirgan yoki allaqachon ishlatilgan. Yangi kod so'rang — eng oxirgi xatdagi kod amal qiladi." />
        </div>
      )}
      <ForgotForm />
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Kirish sahifasiga qaytish
        </Link>
      </p>
    </>
  );
}
