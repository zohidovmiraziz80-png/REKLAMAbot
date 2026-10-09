"use client";

import { useState, useTransition } from "react";
import { adminRecheckDomain, adminRemoveDomain } from "./actions";

export function DomainAdminButtons({ domain }: { domain: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(undefined);
              const r = await adminRecheckDomain(domain);
              if (!r.ok) setError(r.error);
            })
          }
          className="rounded-md px-2 py-1 text-xs font-medium hover:bg-surface disabled:opacity-50"
        >
          Qayta tekshirish
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`${domain} domeni platformadan uzilsinmi?`)) return;
            start(async () => {
              const r = await adminRemoveDomain(domain);
              if (!r.ok) setError(r.error);
            });
          }}
          className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Uzish
        </button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
