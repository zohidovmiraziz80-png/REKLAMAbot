"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { PROJECT_TYPES, type ProjectType } from "@/actions/project-types";
import { createProjectAction } from "./project-actions";
import { PROJECT_TYPE_LABELS } from "./nav";

export function CreateProject({ defaultType }: { defaultType?: ProjectType }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function open() {
    setError(undefined);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await createProjectAction({
        name: String(data.get("name") ?? ""),
        type: String(data.get("type") ?? ""),
      });
      if (result.ok) {
        form.reset();
        close();
        if (result.data.type === "website") router.push(`/dashboard/sites/${result.data.id}`);
        if (result.data.type === "bot") router.push(`/dashboard/bots/${result.data.id}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-brand-700"
      >
        + Yangi loyiha
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-white p-0 shadow-xl backdrop:bg-ink/40"
      >
        <form onSubmit={onSubmit} className="space-y-5 p-6">
          <div>
            <h2 className="text-lg font-semibold">Yangi loyiha</h2>
            <p className="mt-1 text-sm text-muted">Nom va turini tanlang. Keyin uni AI bilan to&apos;ldirasiz.</p>
          </div>

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Nomi</span>
            <input
              name="name"
              required
              maxLength={100}
              placeholder="Masalan: Kiyim do'koni"
              className="block w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
          </label>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Turi</legend>
            <div className="grid gap-2">
              {PROJECT_TYPES.map((t) => (
                <label
                  key={t}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3.5 py-2.5 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
                >
                  <input type="radio" name="type" value={t} defaultChecked={t === (defaultType ?? "website")} className="accent-brand-600" />
                  <span>{PROJECT_TYPE_LABELS[t]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted hover:bg-surface">
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {pending ? "Yaratilmoqda..." : "Yaratish"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
