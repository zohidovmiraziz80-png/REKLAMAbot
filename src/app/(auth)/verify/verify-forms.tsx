"use client";

import { useActionState } from "react";
import { Field, FormAlert, SubmitButton } from "@/components/ui";
import { resendSignupCode, verifySignupCode, type AuthFormState } from "../actions";

export function VerifyCodeForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(verifySignupCode, {});

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert error={state.error} />
      <Field
        label="Tasdiqlash kodi"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={10}
        placeholder="123456"
        className="text-center text-2xl font-semibold tracking-[0.4em]"
      />
      <SubmitButton pendingText="Tekshirilmoqda...">Tasdiqlash</SubmitButton>
    </form>
  );
}

export function ResendCodeForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(resendSignupCode, {});

  return (
    <form action={formAction} className="mt-5 space-y-3 text-center">
      <FormAlert {...state} />
      <p className="text-sm text-muted">
        Kod kelmadimi? Spam papkasini tekshiring yoki{" "}
        <button type="submit" className="font-medium text-brand-600 hover:underline">
          kodni qayta yuboring
        </button>
      </p>
    </form>
  );
}
