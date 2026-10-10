"use client";

import { useState, useTransition } from "react";
import { assignCourierAction } from "./actions";

export function CourierPanel({
  orderId,
  couriers,
  ext,
  onAssigned,
}: {
  orderId: string;
  couriers: { chatId: number; name: string }[];
  ext: Record<string, string>;
  onAssigned: (name: string, chatId: number) => void;
}) {
  const [pick, setPick] = useState(String(couriers[0]?.chatId ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2 rounded-md border border-line bg-surface/50 p-2.5 text-xs">
      <p className="font-semibold">🛵 O&apos;z kuryerim</p>
      {ext.courier_name && <p>Biriktirilgan: <b>{ext.courier_name}</b></p>}
      <div className="flex gap-1.5">
        <select value={pick} onChange={(e) => setPick(e.target.value)} className="min-w-0 flex-1 rounded border border-line bg-white px-2 py-1">
          {couriers.map((c) => (
            <option key={c.chatId} value={c.chatId}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !pick}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await assignCourierAction(orderId, Number(pick));
              if (r.ok) onAssigned(r.data.name, Number(pick));
              else setError(r.error);
            })
          }
          className="rounded-md bg-brand-600 px-3 py-1.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {ext.courier ? "Qayta yuborish" : "Berish"}
        </button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
