"use client";

import { useActionState } from "react";
import { Field, FormAlert, SubmitButton } from "@/components/ui";
import { resetPasswordWithCode, updatePassword, type AuthFormState } from "../actions";

/** Emailga kelgan kod + yangi parol */
export function ResetWithCodeForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(resetPasswordWithCode, {});

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert {...state} />
      <Field
        label="Emaildagi kod"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={10}
        placeholder="123456"
        className="text-center text-xl font-semibold tracking-[0.3em]"
      />
      <Field label="Yangi parol" name="password" type="password" autoComplete="new-password" placeholder="Kamida 8 belgi" />
      <Field label="Parolni takrorlang" name="confirm" type="password" autoComplete="new-password" />
      <SubmitButton pendingText="Saqlanmoqda...">Parolni saqlash</SubmitButton>
    </form>
  );
}

/** Eski havola orqali kelgan (sessiyasi bor) foydalanuvchi uchun */
export function ResetForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(updatePassword, {});

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert {...state} />
      <Field label="Yangi parol" name="password" type="password" autoComplete="new-password" placeholder="Kamida 8 belgi" />
      <Field label="Parolni takrorlang" name="confirm" type="password" autoComplete="new-password" />
      <SubmitButton pendingText="Saqlanmoqda...">Parolni saqlash</SubmitButton>
    </form>
  );
}
