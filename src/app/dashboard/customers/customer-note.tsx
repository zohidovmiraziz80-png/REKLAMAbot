"use client";

import { useState, useTransition } from "react";
import { updateCustomerAction } from "./actions";

export function CustomerNote({ id, initial }: { id: string; initial: string }) {
  const [note, setNote] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-3">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Mijoz haqida izoh (faqat siz ko'rasiz)"
        className="block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
      />
      {note !== saved && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await updateCustomerAction(id, note);
              if (r.ok) setSaved(note);
              else setError(r.error);
            })
          }
          className="mt-2 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Saqlash
        </button>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
