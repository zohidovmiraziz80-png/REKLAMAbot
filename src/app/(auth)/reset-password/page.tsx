import type { Metadata } from "next";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Yangi parol" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Yangi parol</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Akkauntingiz uchun yangi parol o&apos;rnating</p>
      <ResetForm />
    </>
  );
}
