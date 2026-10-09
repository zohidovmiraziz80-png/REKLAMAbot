"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { SiteRenderer } from "@/components/site/renderer";
import {
  BLOCK_LABELS,
  BLOCK_TYPES,
  defaultBlock,
  randomId,
  type Block,
  type BlockType,
  type Site,
} from "@/lib/site/schema";
import { editWebsiteWithAIAction, saveWebsiteAction } from "./actions";

const input =
  "block w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const smallBtn = "rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-surface hover:text-ink disabled:opacity-30";

// ===== Kichik maydon komponentlari =====

function TextField({
  label,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={placeholder} className={input} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={input} />
      )}
    </label>
  );
}

type ItemField = { key: string; label: string; multiline?: boolean; placeholder?: string; narrow?: boolean };

function ItemsEditor<T extends Record<string, string>>({
  items,
  fields,
  onChange,
  newItem,
  itemLabel,
  max,
}: {
  items: T[];
  fields: ItemField[];
  onChange: (items: T[]) => void;
  newItem: () => T;
  itemLabel: string;
  max: number;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border border-line bg-surface/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">
              {itemLabel} {i + 1}
            </span>
            <div className="flex">
              <button type="button" className={smallBtn} disabled={i === 0} onClick={() => onChange(move(items, i, -1))} aria-label="Yuqoriga">
                ↑
              </button>
              <button type="button" className={smallBtn} disabled={i === items.length - 1} onClick={() => onChange(move(items, i, 1))} aria-label="Pastga">
                ↓
              </button>
              <button type="button" className={`${smallBtn} text-red-600`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
                O&apos;chirish
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {fields.map((f) => (
              <div key={f.key} className={f.narrow ? "col-span-1" : "col-span-2"}>
                <TextField
                  label={f.label}
                  value={item[f.key] ?? ""}
                  multiline={f.multiline}
                  placeholder={f.placeholder}
                  onChange={(v) => onChange(items.map((it, j) => (j === i ? ({ ...it, [f.key]: v } as T) : it)))}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      {items.length < max && (
        <button
          type="button"
          onClick={() => onChange([...items, newItem()])}
          className="w-full rounded-lg border border-dashed border-line py-2 text-sm font-medium text-brand-600 hover:border-brand-500"
        >
          + {itemLabel} qo&apos;shish
        </button>
      )}
    </div>
  );
}

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const copy = arr.slice();
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

// ===== Har bir blok turi uchun forma =====

function BlockForm({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  const set = (key: string, value: unknown) => onChange({ ...block, [key]: value } as Block);

  switch (block.type) {
    case "hero":
      return (
        <div className="space-y-3">
          <TextField label="Sarlavha" value={block.heading} onChange={(v) => set("heading", v)} />
          <TextField label="Tavsif" value={block.subheading} onChange={(v) => set("subheading", v)} multiline />
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Tugma matni" value={block.ctaText} onChange={(v) => set("ctaText", v)} />
            <TextField label="Tugma havolasi" value={block.ctaLink} onChange={(v) => set("ctaLink", v)} placeholder="#aloqa" />
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Joylashuv</span>
            <select value={block.align} onChange={(e) => set("align", e.target.value)} className={input}>
              <option value="center">Markazda</option>
              <option value="left">Chapda</option>
            </select>
          </label>
        </div>
      );
    case "features":
      return (
        <div className="space-y-3">
          <TextField label="Bo'lim sarlavhasi" value={block.heading} onChange={(v) => set("heading", v)} />
          <ItemsEditor
            items={block.items}
            itemLabel="Afzallik"
            max={8}
            fields={[
              { key: "icon", label: "Emoji", narrow: true },
              { key: "title", label: "Nomi", narrow: true },
              { key: "text", label: "Izoh", multiline: true },
            ]}
            newItem={() => ({ icon: "⭐", title: "", text: "" })}
            onChange={(items) => set("items", items)}
          />
        </div>
      );
    case "products":
      return (
        <div className="space-y-3">
          <TextField label="Bo'lim sarlavhasi" value={block.heading} onChange={(v) => set("heading", v)} />
          <TextField label="Qisqa izoh" value={block.subheading} onChange={(v) => set("subheading", v)} />
          <ItemsEditor
            items={block.items}
            itemLabel="Mahsulot"
            max={24}
            fields={[
              { key: "name", label: "Nomi", narrow: true },
              { key: "price", label: "Narxi", narrow: true, placeholder: "120 000 so'm" },
              { key: "emoji", label: "Emoji", narrow: true },
              { key: "badge", label: "Belgi", narrow: true, placeholder: "Yangi" },
              { key: "description", label: "Tavsif", multiline: true },
            ]}
            newItem={() => ({ emoji: "📦", name: "", price: "", description: "", badge: "" })}
            onChange={(items) => set("items", items)}
          />
        </div>
      );
    case "about":
      return (
        <div className="space-y-3">
          <TextField label="Sarlavha" value={block.heading} onChange={(v) => set("heading", v)} />
          <TextField label="Matn" value={block.text} onChange={(v) => set("text", v)} multiline />
        </div>
      );
    case "testimonials":
      return (
        <div className="space-y-3">
          <p className="rounded-md bg-accent-50 px-3 py-2 text-xs text-accent-600">
            Faqat haqiqiy mijozlaringiz fikrini yozing.
          </p>
          <TextField label="Sarlavha" value={block.heading} onChange={(v) => set("heading", v)} />
          <ItemsEditor
            items={block.items}
            itemLabel="Fikr"
            max={12}
            fields={[
              { key: "name", label: "Ism", narrow: true },
              { key: "role", label: "Kim (ixtiyoriy)", narrow: true },
              { key: "text", label: "Fikr", multiline: true },
            ]}
            newItem={() => ({ name: "", role: "", text: "" })}
            onChange={(items) => set("items", items)}
          />
        </div>
      );
    case "faq":
      return (
        <div className="space-y-3">
          <TextField label="Sarlavha" value={block.heading} onChange={(v) => set("heading", v)} />
          <ItemsEditor
            items={block.items}
            itemLabel="Savol"
            max={20}
            fields={[
              { key: "q", label: "Savol" },
              { key: "a", label: "Javob", multiline: true },
            ]}
            newItem={() => ({ q: "", a: "" })}
            onChange={(items) => set("items", items)}
          />
        </div>
      );
    case "cta":
      return (
        <div className="space-y-3">
          <TextField label="Sarlavha" value={block.heading} onChange={(v) => set("heading", v)} />
          <TextField label="Matn" value={block.text} onChange={(v) => set("text", v)} multiline />
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Tugma matni" value={block.buttonText} onChange={(v) => set("buttonText", v)} />
            <TextField label="Tugma havolasi" value={block.buttonLink} onChange={(v) => set("buttonLink", v)} placeholder="#aloqa" />
          </div>
        </div>
      );
    case "contact":
      return (
        <div className="space-y-3">
          <TextField label="Sarlavha" value={block.heading} onChange={(v) => set("heading", v)} />
          <TextField label="Matn" value={block.text} onChange={(v) => set("text", v)} multiline />
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Telefon" value={block.phone} onChange={(v) => set("phone", v)} placeholder="+998 90 123 45 67" />
            <TextField label="Telegram" value={block.telegram} onChange={(v) => set("telegram", v)} placeholder="@username" />
            <TextField label="Instagram" value={block.instagram} onChange={(v) => set("instagram", v)} placeholder="@username" />
            <TextField label="Ish vaqti" value={block.workingHours} onChange={(v) => set("workingHours", v)} placeholder="Har kuni 9:00–20:00" />
          </div>
          <TextField label="Manzil" value={block.address} onChange={(v) => set("address", v)} />
        </div>
      );
  }
}

// ===== Asosiy tahrirlovchi =====

export function SiteEditor({
  projectId,
  initialSite,
  initialVersion,
}: {
  projectId: string;
  initialSite: Site;
  initialVersion: number;
}) {
  const [site, setSite] = useState<Site>(initialSite);
  const [version, setVersion] = useState(initialVersion);
  const [dirty, setDirty] = useState(false);
  const [pageIdx, setPageIdx] = useState(0);
  const [openBlock, setOpenBlock] = useState<string | null>(initialSite.pages[0]?.blocks[0]?.id ?? null);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [status, setStatus] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [aiText, setAiText] = useState("");
  const [undoSite, setUndoSite] = useState<Site | null>(null);
  const [saving, startSave] = useTransition();
  const [aiPending, startAi] = useTransition();

  const page = site.pages[Math.min(pageIdx, site.pages.length - 1)];

  // Saqlanmagan o'zgarishlar bilan sahifadan chiqishda ogohlantirish
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function update(mutator: (draft: Site) => Site) {
    setSite((s) => mutator(s));
    setDirty(true);
    setStatus(null);
  }

  function updateBlocks(fn: (blocks: Block[]) => Block[]) {
    update((s) => ({
      ...s,
      pages: s.pages.map((p, i) => (i === pageIdx ? { ...p, blocks: fn(p.blocks) } : p)),
    }));
  }

  function save(after?: (v: number) => void) {
    startSave(async () => {
      const result = await saveWebsiteAction(projectId, site, version);
      if (result.ok) {
        setVersion(result.data.version);
        setDirty(false);
        setStatus({ kind: "ok", text: "Saqlandi" });
        after?.(result.data.version);
      } else {
        setStatus({ kind: "error", text: result.error });
      }
    });
  }

  function runAi() {
    const instruction = aiText.trim();
    if (instruction.length < 3) return;
    const exec = (v: number) =>
      startAi(async () => {
        setStatus(null);
        const before = site;
        const result = await editWebsiteWithAIAction(projectId, instruction, v);
        if (result.ok && result.data.content) {
          setUndoSite(before);
          setSite(result.data.content);
          setVersion(result.data.version);
          setDirty(false);
          setAiText("");
          setPageIdx(0);
          setStatus({ kind: "ok", text: "AI o'zgarishlarni kiritdi va saqladi" });
        } else if (!result.ok) {
          setStatus({ kind: "error", text: result.error });
        }
      });
    if (dirty) save(exec);
    else exec(version);
  }

  function undoAi() {
    if (!undoSite) return;
    setSite(undoSite);
    setUndoSite(null);
    setDirty(true);
    setStatus({ kind: "ok", text: "Avvalgi holat qaytarildi — saqlashni unutmang" });
  }

  const busy = saving || aiPending;

  const preview = useMemo(
    () => (
      <div
        className="h-full overflow-y-auto rounded-xl border border-line bg-white shadow-sm"
        onClickCapture={(e) => {
          // Tahrirlovchi ichida havolalar boshqa sahifaga olib ketmasin
          if ((e.target as HTMLElement).closest("a")) e.preventDefault();
        }}
      >
        <SiteRenderer site={site} page={page} />
      </div>
    ),
    [site, page],
  );

  return (
    <div className="space-y-4">
      {/* Yuqori panel */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {site.pages.map((p, i) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => setPageIdx(i)}
              className={`rounded-full px-3 py-1.5 text-sm ${i === pageIdx ? "bg-brand-50 font-semibold text-brand-700" : "text-muted hover:bg-surface"}`}
            >
              {p.title}
            </button>
          ))}
          {site.pages.length < 6 && (
            <button
              type="button"
              onClick={() => {
                const title = window.prompt("Yangi sahifa nomi", "Yangi sahifa");
                if (!title) return;
                const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sahifa";
                let slug = slugBase;
                let n = 2;
                while (site.pages.some((p) => p.slug === slug)) slug = `${slugBase}-${n++}`;
                update((s) => ({ ...s, pages: [...s.pages, { slug, title: title.slice(0, 60), blocks: [defaultBlock("hero")] }] }));
                setPageIdx(site.pages.length);
              }}
              className="rounded-full px-3 py-1.5 text-sm text-brand-600 hover:bg-surface"
            >
              + Sahifa
            </button>
          )}
        </div>
        <span className={`text-xs ${status?.kind === "error" ? "text-red-600" : "text-muted"}`} aria-live="polite">
          {status?.text ?? (dirty ? "Saqlanmagan o'zgarishlar bor" : "Barcha o'zgarishlar saqlangan")}
        </span>
        <a
          href={`/preview/${projectId}`}
          target="_blank"
          rel="noopener"
          className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:border-brand-500"
        >
          Ko&apos;rish ↗
        </a>
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={() => save()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Saqlanmoqda..." : "Saqlash"}
        </button>
      </div>

      {/* AI bilan tahrirlash */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runAi();
        }}
        className="flex flex-col gap-2 rounded-xl border border-accent-100 bg-accent-50 p-3 sm:flex-row sm:items-center"
      >
        <span className="text-sm font-semibold whitespace-nowrap text-accent-600">⚡ AI&apos;ga ayting:</span>
        <input
          value={aiText}
          onChange={(e) => setAiText(e.target.value)}
          maxLength={1000}
          disabled={aiPending}
          placeholder="Masalan: ranglarni yashil qil, savol-javobga yetkazib berish haqida savol qo'sh"
          className="min-w-0 flex-1 rounded-lg border border-accent-100 bg-white px-3 py-2 text-sm outline-none focus:border-accent-500"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy || aiText.trim().length < 3}
            className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
          >
            {aiPending ? "AI ishlayapti..." : "O'zgartirish"}
          </button>
          {undoSite && !aiPending && (
            <button type="button" onClick={undoAi} className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
              Bekor qilish
            </button>
          )}
        </div>
      </form>

      {/* Telefon uchun almashtirgich */}
      <div className="flex rounded-lg border border-line bg-white p-1 lg:hidden">
        {(["edit", "preview"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setMobileView(v)}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${mobileView === v ? "bg-brand-600 text-white" : "text-muted"}`}
          >
            {v === "edit" ? "Tahrirlash" : "Ko'rinish"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
        {/* Chap panel: sozlamalar va bloklar */}
        <div className={`space-y-4 ${mobileView === "preview" ? "hidden lg:block" : ""}`}>
          <details className="rounded-xl border border-line bg-white p-4" open={false}>
            <summary className="cursor-pointer text-sm font-semibold">🎨 Sayt sozlamalari va ranglar</summary>
            <div className="mt-4 space-y-3">
              <TextField label="Sayt nomi" value={site.name} onChange={(v) => update((s) => ({ ...s, name: v }))} />
              <TextField label="Shior" value={site.tagline} onChange={(v) => update((s) => ({ ...s, tagline: v }))} />
              <div className="grid grid-cols-2 gap-2">
                {(["primary", "accent"] as const).map((k) => (
                  <label key={k} className="block">
                    <span className="mb-1 block text-xs font-medium text-muted">{k === "primary" ? "Asosiy rang" : "Tugma rangi"}</span>
                    <span className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5">
                      <input
                        type="color"
                        value={site.theme[k]}
                        onChange={(e) => update((s) => ({ ...s, theme: { ...s.theme, [k]: e.target.value } }))}
                        className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
                      />
                      <span className="font-mono text-xs">{site.theme[k]}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Shrift</span>
                  <select
                    value={site.theme.font}
                    onChange={(e) => update((s) => ({ ...s, theme: { ...s.theme, font: e.target.value as Site["theme"]["font"] } }))}
                    className={input}
                  >
                    <option value="modern">Zamonaviy</option>
                    <option value="classic">Klassik</option>
                    <option value="rounded">Yumaloq</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Burchaklar</span>
                  <select
                    value={site.theme.radius}
                    onChange={(e) => update((s) => ({ ...s, theme: { ...s.theme, radius: e.target.value as Site["theme"]["radius"] } }))}
                    className={input}
                  >
                    <option value="sharp">O&apos;tkir</option>
                    <option value="soft">Yumshoq</option>
                    <option value="round">Dumaloq</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Fon</span>
                  <select
                    value={site.theme.mode}
                    onChange={(e) => update((s) => ({ ...s, theme: { ...s.theme, mode: e.target.value as Site["theme"]["mode"] } }))}
                    className={input}
                  >
                    <option value="light">Yorug&apos;</option>
                    <option value="dark">Qorong&apos;i</option>
                  </select>
                </label>
              </div>
              {pageIdx > 0 && (
                <div className="space-y-2 border-t border-line pt-3">
                  <TextField
                    label="Joriy sahifa nomi"
                    value={page.title}
                    onChange={(v) => update((s) => ({ ...s, pages: s.pages.map((p, i) => (i === pageIdx ? { ...p, title: v } : p)) }))}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm(`"${page.title}" sahifasi o'chirilsinmi?`)) return;
                      update((s) => ({ ...s, pages: s.pages.filter((_, i) => i !== pageIdx) }));
                      setPageIdx(0);
                    }}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Sahifani o&apos;chirish
                  </button>
                </div>
              )}
            </div>
          </details>

          <div className="space-y-2">
            {page.blocks.map((block, i) => {
              const open = openBlock === block.id;
              return (
                <div key={block.id} className={`rounded-xl border bg-white ${open ? "border-brand-500" : "border-line"}`}>
                  <div className="flex items-center gap-1 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setOpenBlock(open ? null : block.id)}
                      className="min-w-0 flex-1 truncate text-left text-sm font-semibold"
                      aria-expanded={open}
                    >
                      <span className="mr-1 text-muted">{open ? "▾" : "▸"}</span>
                      {BLOCK_LABELS[block.type]}
                      {"heading" in block && block.heading && (
                        <span className="ml-2 font-normal text-muted">· {block.heading}</span>
                      )}
                    </button>
                    <button type="button" className={smallBtn} disabled={i === 0} onClick={() => updateBlocks((b) => move(b, i, -1))} aria-label="Yuqoriga">
                      ↑
                    </button>
                    <button
                      type="button"
                      className={smallBtn}
                      disabled={i === page.blocks.length - 1}
                      onClick={() => updateBlocks((b) => move(b, i, 1))}
                      aria-label="Pastga"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={smallBtn}
                      onClick={() =>
                        updateBlocks((b) => {
                          const copy = b.slice();
                          copy.splice(i + 1, 0, { ...structuredClone(block), id: randomId() });
                          return copy;
                        })
                      }
                      aria-label="Nusxalash"
                      title="Nusxalash"
                    >
                      ⧉
                    </button>
                    <button
                      type="button"
                      className={`${smallBtn} text-red-600`}
                      onClick={() => {
                        if (window.confirm(`"${BLOCK_LABELS[block.type]}" bloki o'chirilsinmi?`)) updateBlocks((b) => b.filter((x) => x.id !== block.id));
                      }}
                      aria-label="O'chirish"
                    >
                      ✕
                    </button>
                  </div>
                  {open && (
                    <div className="border-t border-line p-3">
                      <BlockForm block={block} onChange={(nb) => updateBlocks((b) => b.map((x) => (x.id === block.id ? nb : x)))} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <label className="block rounded-xl border border-dashed border-line bg-white p-3">
            <span className="mb-1 block text-xs font-medium text-muted">Blok qo&apos;shish</span>
            <select
              value=""
              onChange={(e) => {
                const type = e.target.value as BlockType;
                if (!type) return;
                const nb = defaultBlock(type);
                updateBlocks((b) => [...b, nb]);
                setOpenBlock(nb.id);
              }}
              className={input}
            >
              <option value="">— blok turini tanlang —</option>
              {BLOCK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {BLOCK_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* O'ng panel: jonli ko'rinish */}
        <div className={`lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)] ${mobileView === "edit" ? "hidden lg:block" : "h-[75dvh]"}`}>
          {preview}
        </div>
      </div>
    </div>
  );
}
