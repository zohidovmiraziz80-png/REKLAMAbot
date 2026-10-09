"use client";

import { useRef, useState, useTransition } from "react";
import type { PublishStatus, SiteDomainInfo } from "@/actions/publishing";
import {
  addCustomDomainAction,
  checkCustomDomainAction,
  getPublishStatusAction,
  publishWebsiteAction,
  removeCustomDomainAction,
  unpublishWebsiteAction,
} from "./actions";

const UZ_MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
function formatDateTime(iso: string) {
  const d = new Date(new Date(iso).getTime() + 5 * 3600 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()}-${UZ_MONTHS[d.getUTCMonth()]}, ${hh}:${mm}`;
}

const input =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function DomainRow({
  info,
  projectId,
  onChange,
  onRemoved,
}: {
  info: SiteDomainInfo;
  projectId: string;
  onChange: (d: SiteDomainInfo) => void;
  onRemoved: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const badge =
    info.status === "active"
      ? "bg-emerald-50 text-emerald-700"
      : info.status === "error"
        ? "bg-red-50 text-red-700"
        : "bg-accent-50 text-accent-600";
  const label = info.status === "active" ? "Faol" : info.status === "error" ? "Xato" : "Kutilmoqda";

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{info.domain}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`}>{label}</span>
        </div>
        <div className="flex gap-1">
          {info.status === "active" && (
            <a href={`https://${info.domain}`} target="_blank" rel="noopener noreferrer" className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-surface">
              Ochish ↗
            </a>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(undefined);
                const r = await checkCustomDomainAction(projectId, info.domain);
                if (r.ok) onChange(r.data);
                else setError(r.error);
              })
            }
            className="rounded-md px-2 py-1 text-xs font-medium hover:bg-surface disabled:opacity-50"
          >
            {pending ? "Tekshirilmoqda..." : "Tekshirish"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`${info.domain} domeni saytdan uzilsinmi?`)) return;
              start(async () => {
                const r = await removeCustomDomainAction(projectId, info.domain);
                if (r.ok) onRemoved();
                else setError(r.error);
              });
            }}
            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Uzish
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {info.status !== "active" && info.records.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted">
            Domen sotib olingan joyda (DNS sozlamalari) quyidagi yozuvlarni qo&apos;shing. O&apos;zgarish 5 daqiqadan 24 soatgacha tarqaladi,
            keyin &quot;Tekshirish&quot;ni bosing.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="py-1 pr-3 font-medium">Turi</th>
                  <th className="py-1 pr-3 font-medium">Nomi (Host)</th>
                  <th className="py-1 font-medium">Qiymati</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {info.records.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-1.5 pr-3">{r.type}</td>
                    <td className="py-1.5 pr-3">{r.name}</td>
                    <td className="py-1.5 break-all">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function PublishPanel({
  projectId,
  initialStatus,
  dirty,
  saveFirst,
}: {
  projectId: string;
  initialStatus: PublishStatus;
  dirty: boolean;
  saveFirst: () => Promise<boolean>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState(initialStatus);
  const [slug, setSlug] = useState(initialStatus.slug ?? initialStatus.suggestedSlug);
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, start] = useTransition();

  const published = !!status.slug;

  async function reload() {
    const r = await getPublishStatusAction(projectId);
    if (r.ok) setStatus(r.data);
  }

  function publish() {
    const target = slug.trim();
    const msg = published
      ? "Saytdagi oxirgi o'zgarishlar internetdagi versiyaga chiqarilsinmi?"
      : `Sayt internetga chiqarilsin va hamma ko'ra oladigan bo'lsinmi?\nManzil: /s/${target}`;
    if (!window.confirm(msg)) return;
    start(async () => {
      setError(undefined);
      setNotice(undefined);
      if (dirty && !(await saveFirst())) {
        setError("Avval o'zgarishlarni saqlab bo'lmadi");
        return;
      }
      const r = await publishWebsiteAction(projectId, target);
      if (!r.ok) return setError(r.error);
      setNotice(published ? "Yangilandi — o'zgarishlar internetda" : "Sayt internetga chiqdi! 🎉");
      await reload();
    });
  }

  function unpublish() {
    if (!window.confirm("Sayt internetdan olib tashlansinmi? Tahrirlovchidagi nusxa saqlanib qoladi.")) return;
    start(async () => {
      setError(undefined);
      const r = await unpublishWebsiteAction(projectId, status.slug);
      if (!r.ok) return setError(r.error);
      setNotice("Sayt nashrdan olindi");
      await reload();
    });
  }

  function addDomain(e: React.FormEvent) {
    e.preventDefault();
    const d = domain.trim();
    if (!d) return;
    if (!window.confirm(`${d} domeni shu saytga ulansinmi?`)) return;
    start(async () => {
      setError(undefined);
      const r = await addCustomDomainAction(projectId, d);
      if (!r.ok) return setError(r.error);
      setDomain("");
      setStatus((s) => ({ ...s, domains: [...s.domains, r.data] }));
    });
  }

  const liveUrl = status.subdomainUrl ?? status.pathUrl;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(undefined);
          setNotice(undefined);
          dialogRef.current?.showModal();
        }}
        className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${published ? "bg-emerald-600 hover:bg-emerald-700" : "bg-accent-500 hover:bg-accent-600"}`}
      >
        {published ? (status.hasUnpublishedChanges || dirty ? "Nashr ● yangilash" : "Nashr qilingan") : "Nashr qilish"}
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-line bg-white p-0 shadow-xl backdrop:bg-ink/40"
      >
        <div className="space-y-6 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Saytni nashr qilish</h2>
              <p className="mt-1 text-sm text-muted">
                {published
                  ? `Internetda. Oxirgi nashr: ${formatDateTime(status.publishedAt!)}`
                  : "Sayt hali internetda emas. Manzilni tanlang va nashr qiling."}
              </p>
            </div>
            <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-md px-2 py-1 text-muted hover:bg-surface" aria-label="Yopish">
              ✕
            </button>
          </div>

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {notice && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

          {/* Manzil */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">1. Sayt manzili</h3>
            {published && liveUrl && (
              <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="block truncate rounded-lg bg-surface px-3 py-2 font-mono text-sm text-brand-600 hover:underline">
                {liveUrl} ↗
              </a>
            )}
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Manzil nomi (lotin harflari, raqam va -)</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">/s/</span>
                <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} maxLength={40} className={input} />
              </div>
            </label>
            {status.hasUnpublishedChanges && published && (
              <p className="text-xs text-accent-600">Saytda nashr qilinmagan o&apos;zgarishlar bor.</p>
            )}
            {dirty && <p className="text-xs text-accent-600">Saqlanmagan o&apos;zgarishlar nashrdan oldin avtomatik saqlanadi.</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={publish}
                className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
              >
                {pending ? "Bajarilmoqda..." : published ? "O'zgarishlarni nashr qilish" : "Internetga chiqarish"}
              </button>
              {published && (
                <button type="button" disabled={pending} onClick={unpublish} className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                  Nashrdan olish
                </button>
              )}
            </div>
          </section>

          {/* O'z domeni */}
          <section className="space-y-3 border-t border-line pt-5">
            <h3 className="text-sm font-semibold">2. O&apos;z domeningiz (ixtiyoriy)</h3>
            {!status.domainApiConfigured ? (
              <p className="rounded-lg bg-surface px-3 py-2 text-sm text-muted">
                O&apos;z domenini ulash tez orada ishga tushadi. Hozircha sayt yuqoridagi manzil orqali ochiladi.
              </p>
            ) : !published ? (
              <p className="text-sm text-muted">Domen ulash uchun avval saytni nashr qiling.</p>
            ) : (
              <>
                {status.domains.map((d) => (
                  <DomainRow
                    key={d.domain}
                    info={d}
                    projectId={projectId}
                    onChange={(nd) => setStatus((s) => ({ ...s, domains: s.domains.map((x) => (x.domain === nd.domain ? nd : x)) }))}
                    onRemoved={() => setStatus((s) => ({ ...s, domains: s.domains.filter((x) => x.domain !== d.domain) }))}
                  />
                ))}
                {status.domains.length < 3 && (
                  <form onSubmit={addDomain} className="flex gap-2">
                    <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="mening-dokonim.uz" className={input} />
                    <button type="submit" disabled={pending || !domain.trim()} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold whitespace-nowrap text-white hover:bg-brand-700 disabled:opacity-50">
                      Ulash
                    </button>
                  </form>
                )}
              </>
            )}
          </section>
        </div>
      </dialog>
    </>
  );
}
