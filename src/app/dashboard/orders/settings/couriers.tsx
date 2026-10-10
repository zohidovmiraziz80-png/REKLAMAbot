"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CourierSetup } from "@/actions/couriers";
import { removeCourierAction } from "../actions";

export function Couriers({ setup }: { setup: CourierSetup }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  return (
    <section className="mt-6 space-y-3 rounded-2xl border border-line bg-white p-5">
      <div>
        <h2 className="font-semibold">🛵 O&apos;z kuryerlaringiz</h2>
        <p className="mt-0.5 text-sm text-muted">Kuryerga buyurtma Telegram&apos;da manzil, telefon va xarita bilan boradi; u «✅ Yetkazdim» ni bosganda buyurtma yakunlanadi.</p>
      </div>
      {!setup.hasBot ? (
        <p className="text-sm text-muted">Avval Telegram botni ulang.</p>
      ) : (
        <>
          <div>
            <p className="mb-1 text-sm">Kuryerga shu havolani yuboring — u ochib «Start» ni bossa, ro&apos;yxatga qo&apos;shiladi:</p>
            <div className="flex gap-2">
              <code className="block flex-1 truncate rounded-lg bg-surface px-3 py-2 font-mono text-xs select-all">{setup.joinLink}</code>
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard?.writeText(setup.joinLink ?? "").then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  })
                }
                className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface"
              >
                {copied ? "✓" : "Nusxalash"}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted">Havolani faqat ishonchli kuryerga bering.</p>
          </div>
          {setup.couriers.length === 0 ? (
            <p className="text-sm text-muted">Hali kuryer yo&apos;q.</p>
          ) : (
            <ul className="divide-y divide-line">
              {setup.couriers.map((c) => (
                <li key={c.chatId} className="flex items-center justify-between py-2 text-sm">
                  <span>🛵 {c.name}</span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(`${c.name} ro'yxatdan chiqarilsinmi?`)) return;
                      start(async () => {
                        await removeCourierAction(c.chatId);
                        router.refresh();
                      });
                    }}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Chiqarish
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
