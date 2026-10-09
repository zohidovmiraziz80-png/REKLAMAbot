import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Ro'yxatdan o'tish" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Akkaunt yarating</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Sayt, bot va avtomatlashtirishlarni bir joyda boshqaring</p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted">
        Akkauntingiz bormi?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Kirish
        </Link>
      </p>
    </>
  );
}
