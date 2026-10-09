import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Kirish" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Xush kelibsiz</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Akkauntingizga kiring</p>
      <LoginForm next={next} linkError={error === "link"} />
      <p className="mt-6 text-center text-sm text-muted">
        Akkauntingiz yo&apos;qmi?{" "}
        <Link href="/register" className="font-medium text-brand-600 hover:underline">
          Ro&apos;yxatdan o&apos;tish
        </Link>
      </p>
    </>
  );
}
