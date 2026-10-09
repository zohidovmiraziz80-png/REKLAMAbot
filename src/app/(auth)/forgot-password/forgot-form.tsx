"use client";

import { useActionState } from "react";
import { Field, FormAlert, SubmitButton } from "@/components/ui";
import { requestPasswordReset, type AuthFormState } from "../actions";

export function ForgotForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});

  if (state.message) return <FormAlert message={state.message} />;

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert error={state.error} />
      <Field label="Email" name="email" type="email" autoComplete="email" placeholder="siz@example.com" />
      <SubmitButton pendingText="Yuborilmoqda...">Havola yuborish</SubmitButton>
    </form>
  );
}
