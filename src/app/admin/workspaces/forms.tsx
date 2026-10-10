"use client";

import { useState, useTransition } from "react";
import { adminSetPlan, adminSetPrice } from "./actions";

const select = "rounded-md border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-500";

type PlanOption = { id: "bot" | "site" | "site_bot"; name: string };

export function WorkspacePlanForm({
  workspaceId,
  planId,
  status,
  trialEndsAt,
  plans,
}: {
  workspaceId: string;
  planId: PlanOption["id"];
  status: "trial" | "active" | "expired";
  trialEndsAt: string | null;
  plans: PlanOption[];
}) {
  const toDate = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10) : "");
  const [plan, setPlan] = useState(planId);
  const [st, setSt] = useState(status);
  const [trial, setTrial] = useState(toDate(trialEndsAt));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function plus14() {
    const base = trial && new Date(trial) > new Date() ? new Date(trial) : new Date();
    base.setDate(base.getDate() + 14);
    setTrial(base.toISOString().slice(0, 10));
    setSt("trial");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={plan} onChange={(e) => setPlan(e.target.value as PlanOption["id"])} className={select}>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select value={st} onChange={(e) => setSt(e.target.value as typeof st)} className={select}>
        <option value="trial">Sinov</option>
        <option value="active">Faol (to&apos;langan)</option>
        <option value="expired">To&apos;xtatilgan</option>
      </select>
      {st === "trial" && (
        <>
          <input type="date" value={trial} onChange={(e) => setTrial(e.target.value)} className={select} />
          <button type="button" onClick={plus14} className="rounded-md px-2 py-1.5 text-xs font-medium text-brand-600 hover:bg-surface">
            +14 kun
          </button>
        </>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await adminSetPlan({ workspaceId, planId: plan, status: st, trialEndsAt: st === "trial" ? trial || null : null });
            setMsg(r.ok ? { ok: true, text: "Saqlandi" } : { ok: false, text: r.error ?? "Xato" });
          })
        }
        className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        Saqlash
      </button>
      {msg && <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
    </div>
  );
}

export function PlanPriceForm({ planId, name, price }: { planId: PlanOption["id"]; name: string; price: number | null }) {
  const [value, setValue] = useState(price === null ? "" : String(price));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="font-semibold">{name}</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          placeholder="Bo'sh = tez orada"
          className={`${select} w-full`}
        />
        <span className="text-xs whitespace-nowrap text-muted">so&apos;m/oy</span>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await adminSetPrice({ planId, price: value ? Number(value) : null });
            setMsg(r.ok ? { ok: true, text: "Saqlandi" } : { ok: false, text: r.error ?? "Xato" });
          })
        }
        className="mt-2 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        Saqlash
      </button>
      {msg && <span className={`ml-2 text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
    </div>
  );
}
