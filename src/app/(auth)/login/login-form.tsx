"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormAlert, SubmitButton } from "@/components/ui";
import { signIn, type AuthFormState } from "../actions";

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(signIn, {
    error: linkError ? "Havola eskirgan yoki noto'g'ri. Qaytadan urinib ko'ring." : undefined,
  });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/dashboard"} />
      <FormAlert {...state} />
      <Field label="Email" name="email" type="email" autoComplete="email" placeholder="siz@example.com" />
      <Field label="Parol" name="password" type="password" autoComplete="current-password" />
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-brand-600 hover:underline">
          Parolni unutdingizmi?
        </Link>
      </div>
      <SubmitButton pendingText="Kirilmoqda...">Kirish</SubmitButton>
    </form>
  );
}
