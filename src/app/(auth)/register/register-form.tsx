"use client";

import { useActionState } from "react";
import { Field, FormAlert, SubmitButton } from "@/components/ui";
import { signUp, type AuthFormState } from "../actions";

export function RegisterForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(signUp, {});

  if (state.message) return <FormAlert message={state.message} />;

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert error={state.error} />
      <Field label="Ism" name="fullName" autoComplete="name" placeholder="Ismingiz" />
      <Field label="Email" name="email" type="email" autoComplete="email" placeholder="siz@example.com" />
      <Field label="Parol" name="password" type="password" autoComplete="new-password" placeholder="Kamida 8 belgi" />
      <SubmitButton pendingText="Yaratilmoqda...">Akkaunt yaratish</SubmitButton>
    </form>
  );
}
