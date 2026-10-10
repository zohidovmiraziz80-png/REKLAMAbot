"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { BotInfo, BotRequest, RequestStatus } from "@/actions/bots";
import { BUTTON_TYPES, BUTTON_TYPE_LABELS, buttonRows, defaultBotConfig, type BotButton, type BotConfig } from "@/lib/telegram/config";
import { disconnectBotAction, saveBotConfigAction, updateRequestStatusAction } from "./actions";

const input =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const smallBtn = "rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-surface hover:text-ink disabled:opacity-30";

const STATUS_LABELS: Record<RequestStatus, string> = {
  new: "Yangi",
  in_progress: "Jarayonda",
  done: "Bajarildi",
  cancelled: "Bekor qilindi",
};
const STATUS_STYLES: Record<RequestStatus, string> = {
  new: "bg-accent-50 text-accent-600",
  in_progress: "bg-brand-50 text-brand-700",
  done: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-surface text-muted",
};

const UZ_MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
function formatDateTime(iso: string) {
  const d = new Date(new Date(iso).getTime() + 5 * 3600 * 1000);
  return `${d.getUTCDate()}-${UZ_MONTHS[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const copy = arr.slice();
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

// ===== Telegram ko'rinishidagi jonli namuna =====

function ChatPreview({ username, config }: { username: string; config: BotConfig }) {
  const rows = buttonRows(config.buttons);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-[#e7ebf0]">
      <div className="flex items-center gap-2 bg-[#517da2] px-4 py-3 text-white">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white/25 text-sm font-bold">{username.slice(0, 1).toUpperCase()}</span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">@{username}</p>
          <p className="text-xs text-white/75">bot</p>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <div className="ml-auto w-fit rounded-xl rounded-br-sm bg-[#effdde] px-3 py-1.5 text-sm">/start</div>
        <div className="max-w-[85%] rounded-xl rounded-bl-sm bg-white px-3 py-2 text-sm whitespace-pre-line shadow-sm">{config.welcome}</div>
      </div>
      <div className="flex items-center gap-2 border-t border-black/5 bg-white px-2 py-2">
        <span className="rounded-md bg-[#517da2] px-2 py-1 text-xs font-semibold text-white">
          {config.siteUrl ? `🛍 ${config.menuButtonText || "Do'kon"}` : "☰ Menyu"}
        </span>
        <span className="flex-1 text-xs text-muted">Xabar yozing...</span>
      </div>
      <div className="space-y-1.5 border-t border-black/5 bg-[#f4f4f5] p-2">
        {rows.length === 0 && <p className="py-2 text-center text-xs text-muted">Menyu tugmalari yo&apos;q</p>}
        {rows.map((row, i) => (
          <div key={i} className="flex gap-1.5">
            {row.map((b) => (
              <span key={b.id} className="flex-1 truncate rounded-md bg-white px-2 py-2 text-center text-xs font-medium shadow-sm">
                {b.type === "webapp" && "↗ "}
                {b.label}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Arizalar ro'yxati =====

function RequestRow({ projectId, request }: { projectId: string; request: BotRequest }) {
  const [status, setStatus] = useState<RequestStatus>(request.status);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            {request.customer_name ?? "Mijoz"}
            {request.username && (
              <a href={`https://t.me/${request.username}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-sm font-normal text-brand-600 hover:underline">
                @{request.username}
              </a>
            )}
          </p>
          {request.phone && (
            <a href={`tel:${request.phone.replace(/\s/g, "")}`} className="text-sm text-brand-600 hover:underline">
              {request.phone}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">{formatDateTime(request.created_at)}</span>
          <select
            value={status}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.value as RequestStatus;
              const prev = status;
              setStatus(next);
              start(async () => {
                setError(undefined);
                const r = await updateRequestStatusAction(projectId, request.id, next);
                if (!r.ok) {
                  setStatus(prev);
                  setError(r.error);
                }
              });
            }}
            className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
          >
            {(Object.keys(STATUS_LABELS) as RequestStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-2 text-sm whitespace-pre-line">{request.message}</p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </li>
  );
}

// ===== Asosiy panel =====

export function BotDashboard({ initial }: { initial: BotInfo }) {
  const router = useRouter();
  const [config, setConfig] = useState<BotConfig>(initial.config);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<"menu" | "requests">(initial.requests.some((r) => r.status === "new") ? "requests" : "menu");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, startSave] = useTransition();
  const [disconnecting, startDisconnect] = useTransition();

  const username = initial.username ?? "bot";
  const newCount = initial.requests.filter((r) => r.status === "new").length;

  function update(patch: Partial<BotConfig>) {
    setConfig((c) => ({ ...c, ...patch }));
    setDirty(true);
    setStatus(null);
  }

  function updateButton(id: string, patch: Partial<BotButton>) {
    update({ buttons: config.buttons.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  }

  function save() {
    const labels = config.buttons.map((b) => b.label.trim());
    if (labels.some((l) => !l)) return setStatus({ kind: "error", text: "Har bir tugmaga nom yozing" });
    if (new Set(labels).size !== labels.length) return setStatus({ kind: "error", text: "Tugma nomlari takrorlanmasin" });
    startSave(async () => {
      const r = await saveBotConfigAction(initial.projectId, config);
      if (r.ok) {
        setConfig(r.data.config);
        setDirty(false);
        setStatus(
          r.data.menuButtonSynced
            ? { kind: "ok", text: "Saqlandi — bot darhol yangi menyu bilan ishlaydi" }
            : { kind: "error", text: "Saqlandi, lekin Telegram menyu tugmasini yangilamadi. Birozdan keyin qayta saqlang." },
        );
      } else setStatus({ kind: "error", text: r.error });
    });
  }

  function disconnect() {
    if (!window.confirm(`@${username} boti uzilsinmi? Bot javob berishni to'xtatadi. Arizalar saqlanib qoladi.`)) return;
    startDisconnect(async () => {
      const r = await disconnectBotAction(initial.projectId);
      if (r.ok) router.refresh();
      else setStatus({ kind: "error", text: r.error });
    });
  }

  return (
    <div className="space-y-5">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4">
        <div>
          <div className="flex items-center gap-2">
            <a href={`https://t.me/${username}`} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold hover:text-brand-600">
              @{username} ↗
            </a>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${initial.status === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
              {initial.status === "error" ? "Xato" : "Ishlayapti"}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {initial.subscribers} ta obunachi · {initial.requests.length} ta ariza
            {initial.lastError && <span className="text-red-600"> · {initial.lastError}</span>}
          </p>
        </div>
        <button type="button" onClick={disconnect} disabled={disconnecting} className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
          {disconnecting ? "Uzilmoqda..." : "Botni uzish"}
        </button>
      </div>

      {/* Administratorni ulash */}
      {!initial.ownerLinked && initial.ownerLink && (
        <div className="flex flex-col gap-3 rounded-xl border border-accent-100 bg-accent-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-accent-600">🔔 Yangi arizalar haqida xabar olish</p>
            <p className="text-sm text-ink/80">Tugmani bosing va Telegram&apos;da <b>Start</b>ni bosing — yangi arizalar sizga darhol keladi.</p>
          </div>
          <a
            href={initial.ownerLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-accent-500 px-4 py-2 text-center text-sm font-semibold whitespace-nowrap text-white hover:bg-accent-600"
          >
            Telegram&apos;da ulash ↗
          </a>
        </div>
      )}
      {initial.ownerLinked && (
        <p className="text-sm text-emerald-700">✅ Yangi arizalar Telegram&apos;dagi administrator chatiga yuboriladi.</p>
      )}

      {/* Bo'limlar */}
      <div className="flex gap-1 rounded-lg border border-line bg-white p-1">
        {(
          [
            ["menu", "Menyu va javoblar"],
            ["requests", `Arizalar${newCount ? ` (${newCount} yangi)` : ""}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${tab === key ? "bg-brand-600 text-white" : "text-muted hover:bg-surface"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "requests" ? (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          {initial.requests.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="font-medium">Hali ariza yo&apos;q</p>
              <p className="mt-1 text-sm text-muted">Mijozlar botda &quot;Ariza / buyurtma&quot; turidagi tugmani bosganda shu yerda paydo bo&apos;ladi.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {initial.requests.map((r) => (
                <RequestRow key={r.id} projectId={initial.projectId} request={r} />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <section className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/50 p-4">
              <div>
                <h2 className="text-sm font-semibold">🛍 Sayt bot ichida (Mini App)</h2>
                <p className="text-xs text-muted">
                  Mijoz xabar maydoni yonidagi tugmani bosganda saytingiz Telegram ichida ochiladi — buyurtma saytda beriladi.
                </p>
              </div>
              {initial.sites.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {initial.sites.map((site) => (
                    <button
                      key={site.url}
                      type="button"
                      onClick={() => update({ siteUrl: site.url })}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${config.siteUrl === site.url ? "border-brand-500 bg-white text-brand-700" : "border-line bg-white hover:border-brand-500"}`}
                    >
                      {site.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
                <input
                  value={config.siteUrl}
                  onChange={(e) => update({ siteUrl: e.target.value })}
                  placeholder="https://... (bo'sh qoldirsangiz, menyu tugmasi oddiy bo'ladi)"
                  className={input}
                />
                <input
                  value={config.menuButtonText}
                  onChange={(e) => update({ menuButtonText: e.target.value })}
                  maxLength={20}
                  placeholder="Tugma nomi"
                  className={input}
                />
              </div>
              {initial.sites.length === 0 && (
                <p className="text-xs text-muted">Hali nashr qilingan saytingiz yo&apos;q. Saytni nashr qilsangiz, shu yerda tanlash mumkin bo&apos;ladi yoki istalgan https manzilni yozing.</p>
              )}
            </section>

            <section className="space-y-2 rounded-xl border border-line bg-white p-4">
              <h2 className="text-sm font-semibold">Salomlashish xabari</h2>
              <p className="text-xs text-muted">Mijoz botni ochib Start bosganda yuboriladi.</p>
              <textarea value={config.welcome} onChange={(e) => update({ welcome: e.target.value })} rows={3} maxLength={1000} className={input} />
            </section>

            <section className="space-y-3 rounded-xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Menyu tugmalari</h2>
                  <p className="text-xs text-muted">Ikkitadan qatorga joylashadi; &quot;Butun qator&quot; belgilangani alohida qatorda (12 tagacha).</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Menyu tavsiya etilgan ko'rinishga almashtirilsinmi? (Do'konni ochish · Buyurtmalarim · Aloqa)")) {
                      update({ buttons: defaultBotConfig(initial.projectName, config.siteUrl).buttons });
                    }
                  }}
                  className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:border-brand-500"
                >
                  ↺ Tavsiya etilgan menyu
                </button>
              </div>
              {config.buttons.map((b, i) => (
                <div key={b.id} className="space-y-2 rounded-lg border border-line bg-surface/60 p-3">
                  <div className="flex items-center gap-1">
                    <input
                      value={b.label}
                      onChange={(e) => updateButton(b.id, { label: e.target.value })}
                      maxLength={40}
                      placeholder="Tugma nomi, masalan: 🛒 Buyurtma berish"
                      className={`${input} font-medium`}
                    />
                    <button type="button" className={smallBtn} disabled={i === 0} onClick={() => update({ buttons: move(config.buttons, i, -1) })} aria-label="Yuqoriga">
                      ↑
                    </button>
                    <button
                      type="button"
                      className={smallBtn}
                      disabled={i === config.buttons.length - 1}
                      onClick={() => update({ buttons: move(config.buttons, i, 1) })}
                      aria-label="Pastga"
                    >
                      ↓
                    </button>
                    <button type="button" className={`${smallBtn} text-red-600`} onClick={() => update({ buttons: config.buttons.filter((x) => x.id !== b.id) })} aria-label="O'chirish">
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={b.type}
                      onChange={(e) => updateButton(b.id, { type: e.target.value as BotButton["type"] })}
                      className={`${input} min-w-0 flex-1`}
                    >
                      {BUTTON_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {BUTTON_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted">
                      <input type="checkbox" checked={b.wide} onChange={(e) => updateButton(b.id, { wide: e.target.checked })} className="accent-brand-600" />
                      Butun qator
                    </label>
                  </div>
                  {b.type === "text" && (
                    <textarea
                      value={b.text}
                      onChange={(e) => updateButton(b.id, { text: e.target.value })}
                      rows={3}
                      maxLength={2000}
                      placeholder="Tugma bosilganda yuboriladigan javob"
                      className={input}
                    />
                  )}
                  {b.type === "webapp" && (
                    <div className="space-y-1">
                      <input
                        value={b.url}
                        onChange={(e) => updateButton(b.id, { url: e.target.value })}
                        placeholder="Bo'sh — yuqoridagi Mini App sayti ochiladi"
                        className={input}
                      />
                      <p className="text-xs text-muted">Tugma bosilganda sayt Telegram ichida ochiladi.</p>
                    </div>
                  )}
                  {b.type === "link" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input value={b.url} onChange={(e) => updateButton(b.id, { url: e.target.value })} placeholder="https://... yoki @kanal" className={input} />
                      <input value={b.text} onChange={(e) => updateButton(b.id, { text: e.target.value })} placeholder="Izoh (ixtiyoriy)" className={input} />
                    </div>
                  )}
                  {b.type === "orders" && (
                    <p className="text-xs text-muted">Mijoz bosganda bot uning oxirgi 5 ta buyurtmasini holati bilan ko&apos;rsatadi.</p>
                  )}
                  {b.type === "request" && (
                    <p className="text-xs text-muted">Bot mijozdan telefon raqami va xabarini so&apos;raydi, so&apos;ng arizani &quot;Arizalar&quot; bo&apos;limiga saqlaydi.</p>
                  )}
                </div>
              ))}
              {config.buttons.length < 12 && (
                <button
                  type="button"
                  onClick={() => update({ buttons: [...config.buttons, { id: newId(), label: "", type: "text", text: "", url: "", wide: false }] })}
                  className="w-full rounded-lg border border-dashed border-line py-2 text-sm font-medium text-brand-600 hover:border-brand-500"
                >
                  + Tugma qo&apos;shish
                </button>
              )}
            </section>

            {config.buttons.some((b) => b.type === "request") && (
              <details className="rounded-xl border border-line bg-white p-4">
                <summary className="cursor-pointer text-sm font-semibold">Ariza qabul qilish matnlari</summary>
                <div className="mt-3 space-y-3">
                  {(
                    [
                      ["requestPhonePrompt", "1. Telefon so'rash"],
                      ["requestMessagePrompt", "2. Xabar so'rash"],
                      ["requestThanks", "3. Rahmat xabari"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block">
                      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
                      <textarea value={config[key]} onChange={(e) => update({ [key]: e.target.value } as Partial<BotConfig>)} rows={2} maxLength={300} className={input} />
                    </label>
                  ))}
                </div>
              </details>
            )}

            <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-3 shadow-sm">
              <span className={`text-sm ${status?.kind === "error" ? "text-red-600" : "text-muted"}`} aria-live="polite">
                {status?.text ?? (dirty ? "Saqlanmagan o'zgarishlar bor" : "Barcha o'zgarishlar saqlangan")}
              </span>
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving}
                className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>

          <div className="lg:sticky lg:top-4 lg:self-start">
            <p className="mb-2 text-xs font-medium text-muted">Telegram&apos;da shunday ko&apos;rinadi</p>
            <ChatPreview username={username} config={config} />
          </div>
        </div>
      )}
    </div>
  );
}
