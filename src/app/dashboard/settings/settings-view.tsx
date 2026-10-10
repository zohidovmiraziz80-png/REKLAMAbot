"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SettingsData } from "@/actions/settings";
import {
  addMemberAction,
  changePasswordAction,
  removeMemberAction,
  renameWorkspaceAction,
  saveProfileAction,
  switchWorkspaceAction,
  updateMemberRoleAction,
} from "./actions";

const input =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const primary = "rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50";
const ROLE_LABEL = { owner: "Egasi", admin: "Admin", member: "Xodim" } as const;

type Msg = { ok: boolean; text: string } | null;
function Note({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>;
}

function Card({ id, title, hint, children }: { id?: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-4 rounded-2xl border border-line bg-white p-5">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function SettingsView({ data }: { data: SettingsData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isOwner = data.workspace.role === "owner";
  const isAdmin = isOwner || data.workspace.role === "admin";

  const [wsName, setWsName] = useState(data.workspace.name);
  const [wsMsg, setWsMsg] = useState<Msg>(null);
  const [fullName, setFullName] = useState(data.profile.fullName);
  const [phone, setPhone] = useState(data.profile.phone || "+998 ");
  const [profMsg, setProfMsg] = useState<Msg>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState<Msg>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [staffMsg, setStaffMsg] = useState<Msg>(null);

  return (
    <div className="space-y-5">
      <Card title="Do'kon (workspace)" hint="Bu nom yon menyuda va hisob-kitoblarda ko'rinadi.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await renameWorkspaceAction(wsName);
              setWsMsg(r.ok ? { ok: true, text: "Saqlandi ✓" } : { ok: false, text: r.error });
              if (r.ok) router.refresh();
            });
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <input value={wsName} onChange={(e) => setWsName(e.target.value)} disabled={!isOwner} maxLength={80} className={input} />
          {isOwner && (
            <button type="submit" disabled={pending || wsName.trim() === data.workspace.name} className={primary}>
              Saqlash
            </button>
          )}
        </form>
        {!isOwner && <p className="text-xs text-muted">Nomni faqat do&apos;kon egasi o&apos;zgartira oladi.</p>}
        <Note msg={wsMsg} />
      </Card>

      {data.workspaces.length > 1 && (
        <Card title="Do'konlarim" hint="Siz bir nechta do'konga a'zosiz — qaysi birini boshqarishni tanlang.">
          <ul className="divide-y divide-line">
            {data.workspaces.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <b>{w.name}</b> <span className="text-muted">· {ROLE_LABEL[w.role]}</span>
                </span>
                {w.id === data.workspace.id ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Hozirgi</span>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await switchWorkspaceAction(w.id);
                        if (r.ok) router.push("/dashboard");
                      })
                    }
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface"
                  >
                    O&apos;tish
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Profil">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveProfileAction({ fullName, phone });
              setProfMsg(r.ok ? { ok: true, text: "Saqlandi ✓" } : { ok: false, text: r.error });
              if (r.ok) router.refresh();
            });
          }}
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Ism</span>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} className={input} autoComplete="name" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Telefon</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={input} autoComplete="tel" />
            </label>
          </div>
          <p className="text-sm text-muted">
            Email: <b className="text-ink">{data.profile.email}</b>
          </p>
          <button type="submit" disabled={pending} className={primary}>
            Saqlash
          </button>
        </form>
        <Note msg={profMsg} />
      </Card>

      <Card title="Parolni o'zgartirish">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pw !== pw2) return setPwMsg({ ok: false, text: "Parollar bir xil emas" });
            start(async () => {
              const r = await changePasswordAction(pw);
              setPwMsg(r.ok ? { ok: true, text: "Parol o'zgartirildi ✓" } : { ok: false, text: r.error });
              if (r.ok) {
                setPw("");
                setPw2("");
              }
            });
          }}
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Yangi parol (kamida 8 belgi)" autoComplete="new-password" className={input} />
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Yana bir marta" autoComplete="new-password" className={input} />
          </div>
          <button type="submit" disabled={pending || pw.length < 8} className={primary}>
            Parolni o&apos;zgartirish
          </button>
        </form>
        <Note msg={pwMsg} />
      </Card>

      <Card id="staff" title="Xodimlar" hint="Xodimlar buyurtma, mahsulot va mijozlar bilan ishlaydi. Admin integratsiya va sozlamalarni ham o'zgartira oladi.">
        <ul className="divide-y divide-line">
          {data.members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
              <div className="grid size-9 place-items-center rounded-full bg-brand-50 font-semibold text-brand-700">{(m.name || m.email || "?").slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {m.name || m.email}
                  {m.you && <span className="ml-1 text-xs text-muted">(siz)</span>}
                </p>
                <p className="truncate text-xs text-muted">{m.email}</p>
              </div>
              {isOwner && m.role !== "owner" && !m.you ? (
                <select
                  value={m.role}
                  disabled={pending}
                  onChange={(e) =>
                    start(async () => {
                      const r = await updateMemberRoleAction({ userId: m.userId, role: e.target.value as "admin" | "member" });
                      if (!r.ok) setStaffMsg({ ok: false, text: r.error });
                      else router.refresh();
                    })
                  }
                  className="rounded-lg border border-line bg-white px-2 py-1 text-xs"
                >
                  <option value="member">Xodim</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium">{ROLE_LABEL[m.role]}</span>
              )}
              {isAdmin && m.role !== "owner" && !m.you && (isOwner || m.role === "member") && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`${m.name || m.email} do'kondan chiqarilsinmi?`)) return;
                    start(async () => {
                      const r = await removeMemberAction(m.userId);
                      if (!r.ok) setStaffMsg({ ok: false, text: r.error });
                      else router.refresh();
                    });
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Chiqarish
                </button>
              )}
            </li>
          ))}
        </ul>
        {isAdmin && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await addMemberAction({ email, role });
                setStaffMsg(r.ok ? { ok: true, text: "Xodim qo'shildi ✓ U tizimga kirganda Sozlamalar → Do'konlarim orqali shu do'konga o'tadi." } : { ok: false, text: r.error });
                if (r.ok) {
                  setEmail("");
                  router.refresh();
                }
              });
            }}
            className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row"
          >
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="xodim@gmail.com" autoComplete="off" className={input} />
            <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "member")} className={`${input} sm:w-32`}>
              <option value="member">Xodim</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" disabled={pending || !email} className={`${primary} whitespace-nowrap`}>
              + Qo&apos;shish
            </button>
          </form>
        )}
        <p className="text-xs text-muted">Xodim avval MIXBOT&apos;da o&apos;z email&apos;i bilan ro&apos;yxatdan o&apos;tgan bo&apos;lishi kerak.</p>
        <Note msg={staffMsg} />
      </Card>
    </div>
  );
}
