"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ShopSettings } from "@/actions/shop";
import { saveShopSettingsAction } from "../actions";

const input =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const digits = (v: string) => v.replace(/\D/g, "");
const spaced = (v: string) => (v ? v.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "");

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function SettingsForm({ initial }: { initial: ShopSettings }) {
  const [acceptOrders, setAcceptOrders] = useState(initial.accept_orders);
  const [pickupEnabled, setPickupEnabled] = useState(initial.pickup_enabled);
  const [pickupAddress, setPickupAddress] = useState(initial.pickup_address);
  const [deliveryEnabled, setDeliveryEnabled] = useState(initial.delivery_enabled);
  const [deliveryPrice, setDeliveryPrice] = useState(String(initial.delivery_price ?? 0));
  const [freeFrom, setFreeFrom] = useState(initial.free_delivery_from === null ? "" : String(initial.free_delivery_from));
  const [minOrder, setMinOrder] = useState(String(initial.min_order ?? 0));
  const [thanks, setThanks] = useState(initial.order_thanks);
  const [cash, setCash] = useState(initial.cash_enabled ?? true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      setMsg(null);
      const r = await saveShopSettingsAction({
        acceptOrders,
        pickupEnabled,
        pickupAddress,
        deliveryEnabled,
        deliveryPrice: Number(deliveryPrice || 0),
        freeDeliveryFrom: freeFrom ? Number(freeFrom) : null,
        minOrder: Number(minOrder || 0),
        orderThanks: thanks,
        cashEnabled: cash,
      });
      setMsg(r.ok ? { ok: true, text: "Saqlandi" } : { ok: false, text: r.error });
    });
  }

  return (
    <form onSubmit={save} className="space-y-6 rounded-2xl border border-line bg-white p-5">
      <div>
        <h1 className="text-xl font-semibold">Do&apos;kon sozlamalari</h1>
        <p className="mt-1 text-sm text-muted">Sayt va Telegram Mini App&apos;dagi savat shu sozlamalar bilan ishlaydi.</p>
      </div>

      <Toggle checked={acceptOrders} onChange={setAcceptOrders} label="Onlayn buyurtma qabul qilish" hint="O'chirilsa, katalog ko'rinadi, lekin savat yopiladi" />

      <div className="space-y-3 border-t border-line pt-5">
        <Toggle checked={pickupEnabled} onChange={setPickupEnabled} label="🏪 Olib ketish" />
        {pickupEnabled && (
          <label className="block pl-7">
            <span className="mb-1 block text-sm text-muted">Olib ketish manzili</span>
            <input value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} maxLength={300} className={input} placeholder="Toshkent, Chilonzor 9, “Gulzor” do'koni" />
          </label>
        )}
      </div>

      <div className="space-y-3 border-t border-line pt-5">
        <Toggle checked={deliveryEnabled} onChange={setDeliveryEnabled} label="🚚 Yetkazib berish" />
        {deliveryEnabled && (
          <div className="grid gap-3 pl-7 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Yetkazish narxi (so&apos;m)</span>
              <input value={spaced(deliveryPrice)} onChange={(e) => setDeliveryPrice(digits(e.target.value))} inputMode="numeric" className={input} placeholder="0 = bepul" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Shu summadan bepul</span>
              <input value={spaced(freeFrom)} onChange={(e) => setFreeFrom(digits(e.target.value))} inputMode="numeric" className={input} placeholder="ixtiyoriy" />
            </label>
          </div>
        )}
      </div>

      <div className="grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Minimal buyurtma (so&apos;m)</span>
          <input value={spaced(minOrder)} onChange={(e) => setMinOrder(digits(e.target.value))} inputMode="numeric" className={input} placeholder="0" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium">Buyurtmadan keyin mijozga xabar (Telegram)</span>
          <textarea value={thanks} onChange={(e) => setThanks(e.target.value)} maxLength={500} rows={2} className={input} placeholder="Tez orada siz bilan bog'lanamiz." />
        </label>
      </div>

      <div className="flex items-center gap-3 border-t border-line pt-5">
        <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {pending ? "Saqlanmoqda…" : "Saqlash"}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
      </div>
      <div className="space-y-2 border-t border-line pt-5">
        <Toggle checked={cash} onChange={setCash} label="💵 Qabul qilganda to'lash (naqd yoki karta)" hint="O'chirsangiz, mijoz faqat onlayn to'laydi (Payme/Click/Multicard ulangan bo'lishi kerak)" />
        <p className="pl-7 text-xs text-muted">
          Onlayn to&apos;lov: <Link href="/dashboard/integrations/payme" className="text-brand-600 hover:underline">Payme</Link> ·{" "}
          <Link href="/dashboard/integrations/click" className="text-brand-600 hover:underline">Click</Link> ·{" "}
          <Link href="/dashboard/integrations/multicard" className="text-brand-600 hover:underline">Multicard</Link>
        </p>
      </div>
    </form>
  );
}
