"use client";

import { useActionState } from "react";
import { Field, FormAlert, SubmitButton } from "@/components/ui";
import { updatePassword, type AuthFormState } from "../actions";

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
