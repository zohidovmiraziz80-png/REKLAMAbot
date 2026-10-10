"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { FramePreview } from "@/components/site/frame-preview";
import { BlockPreview, SiteRenderer } from "@/components/site/renderer";
import {
  BLOCK_LABELS,
  BLOCK_TYPES,
  BLOCK_VARIANTS,
  DEFAULT_BLOCK_STYLE,
  defaultBlock,
  randomId,
  type Block,
  type BlockStyle,
  type BlockType,
  type Site,
} from "@/lib/site/schema";
import { uploadImage } from "@/lib/upload-image";
import type { PublishStatus } from "@/actions/publishing";
import type { ShopData } from "@/lib/shop/types";
import { editWebsiteWithAIAction, saveWebsiteAction } from "./actions";
import { PublishPanel } from "./publish-panel";

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


function SelectField<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={input}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <div className="flex rounded-md border border-line bg-surface p-0.5">
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium ${value === v ? "bg-white text-brand-700 shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** Rasm: yuklash (kompyuter/telefondan) yoki manzil */
function ImageField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <div className="flex items-center gap-2">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-14 shrink-0 rounded-md border border-line object-cover" />
        ) : (
          <div className="grid size-14 shrink-0 place-items-center rounded-md border border-dashed border-line text-xl text-muted">🖼</div>
        )}
        <div className="flex flex-wrap gap-1.5">
          <input
            ref={ref}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setBusy(true);
              setError(null);
              const r = await uploadImage(f, 2000);
              setBusy(false);
              if (r.ok) onChange(r.url);
              else setError(r.error);
            }}
          />
          <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-surface disabled:opacity-50">
            {busy ? "Yuklanmoqda…" : value ? "Almashtirish" : "📷 Yuklash"}
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")} className="rounded-md px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50">
              Olib tashlash
            </button>
          )}
        </div>
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const BG_OPTIONS: [BlockStyle["bg"], string][] = [
  ["default", "Standart"],
  ["surface", "Kulrang"],
  ["primary", "Asosiy rang"],
  ["accent", "Tugma rangi"],
  ["dark", "Qorong'i"],
  ["custom", "O'z rangim"],
  ["image", "Rasm"],
];

/** Har bir blok uchun dizayn: fon, bo'shliq, joylashuv */
function StyleEditor({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  const st: BlockStyle = { ...DEFAULT_BLOCK_STYLE, ...(block.style ?? {}) };
  const set = (patch: Partial<BlockStyle>) => onChange({ ...block, style: { ...st, ...patch } } as Block);
  const variants = BLOCK_VARIANTS[block.type];
  return (
    <div className="space-y-3">
      {variants && (
        <div>
          <span className="mb-1 block text-xs font-medium text-muted">Ko&apos;rinish (tayyor dizayn)</span>
          <div className="grid grid-cols-2 gap-1.5">
            {variants.map((v, i) => {
              const active = (block.variant ?? variants[0].id) === v.id || (!block.variant && i === 0);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onChange({ ...block, variant: v.id } as Block)}
                  className={`rounded-md border px-2 py-1.5 text-xs font-medium ${active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line hover:border-brand-500"}`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <SelectField label="Fon" value={st.bg} options={BG_OPTIONS} onChange={(v) => set({ bg: v })} />
      {st.bg === "custom" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="color" value={st.bgColor} onChange={(e) => set({ bgColor: e.target.value })} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
          <span className="font-mono text-xs">{st.bgColor}</span>
        </label>
      )}
      {st.bg === "image" && <ImageField label="Fon rasmi" value={st.bgImage} onChange={(v) => set({ bgImage: v })} hint="Matn o'qilishi uchun rasm biroz qoraytiriladi" />}
      <Segmented label="Bo'shliq (yuqori va past)" value={st.pad} options={[["sm", "Kichik"], ["md", "O'rta"], ["lg", "Katta"]]} onChange={(v) => set({ pad: v })} />
      {block.type !== "hero" && block.type !== "image" && (
        <Segmented label="Sarlavha joylashuvi" value={st.align} options={[["center", "Markazda"], ["left", "Chapda"]]} onChange={(v) => set({ align: v })} />
      )}
    </div>
  );
}

const BLOCK_ICONS: Record<BlockType, string> = {
  hero: "🏁",
  features: "✨",
  shop: "🛍",
  image: "🖼",
  gallery: "🗂",
  text: "📝",
  products: "📦",
  about: "ℹ️",
  testimonials: "💬",
  faq: "❓",
  cta: "📣",
  contact: "📞",
};

// ===== Har bir blok turi uchun forma =====

function BlockForm({ block, onChange, categories }: { block: Block; onChange: (b: Block) => void; categories: string[] }) {
  const [tab, setTab] = useState<"content" | "design">("content");
  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-lg bg-surface p-1">
        {(
          [
            ["content", "✏️ Mazmun"],
            ["design", "🎨 Dizayn"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium ${tab === k ? "bg-white text-brand-700 shadow-sm" : "text-muted"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === "content" ? <BlockContentForm block={block} onChange={onChange} categories={categories} /> : <StyleEditor block={block} onChange={onChange} />}
    </div>
  );
}

function BlockContentForm({ block, onChange, categories }: { block: Block; onChange: (b: Block) => void; categories: string[] }) {
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
          <Segmented label="Matn joylashuvi" value={block.align} options={[["center", "Markazda"], ["left", "Chapda"]]} onChange={(v) => set("align", v)} />
          <ImageField label="Rasm" value={block.image ?? ""} onChange={(v) => set("image", v)} />
          {block.image && (
            <Segmented
              label="Rasm qayerda"
              value={block.imageMode ?? "background"}
              options={[["background", "Orqa fonda"], ["side", "Yonida"]]}
              onChange={(v) => set("imageMode", v)}
            />
          )}
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
          <ImageField label="Rasm (yonida chiqadi)" value={block.image ?? ""} onChange={(v) => set("image", v)} />
        </div>
      );
    case "image":
      return (
        <div className="space-y-3">
          <ImageField label="Rasm" value={block.src} onChange={(v) => set("src", v)} />
          <TextField label="Izoh (rasm ostida)" value={block.caption} onChange={(v) => set("caption", v)} />
          <TextField label="Bosilganda ochiladigan havola" value={block.link} onChange={(v) => set("link", v)} placeholder="#katalog yoki https://..." />
          <Segmented label="Kenglik" value={block.width} options={[["contained", "Konteyner"], ["full", "To'liq ekran"]]} onChange={(v) => set("width", v)} />
        </div>
      );
    case "gallery":
      return (
        <div className="space-y-3">
          <TextField label="Sarlavha" value={block.heading} onChange={(v) => set("heading", v)} />
          <Segmented label="Ustunlar" value={block.columns} options={[["2", "2"], ["3", "3"], ["4", "4"]]} onChange={(v) => set("columns", v)} />
          <div className="space-y-2">
            {block.images.map((im, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-line bg-surface/60 p-2">
                <div className="flex-1 space-y-2">
                  <ImageField label={`Rasm ${i + 1}`} value={im.src} onChange={(v) => set("images", block.images.map((x, j) => (j === i ? { ...x, src: v } : x)))} />
                  <TextField label="Izoh" value={im.caption} onChange={(v) => set("images", block.images.map((x, j) => (j === i ? { ...x, caption: v } : x)))} />
                </div>
                <div className="flex flex-col">
                  <button type="button" className={smallBtn} disabled={i === 0} onClick={() => set("images", move(block.images, i, -1))}>
                    ↑
                  </button>
                  <button type="button" className={smallBtn} disabled={i === block.images.length - 1} onClick={() => set("images", move(block.images, i, 1))}>
                    ↓
                  </button>
                  <button type="button" className={`${smallBtn} text-red-600`} onClick={() => set("images", block.images.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {block.images.length < 24 && (
              <button
                type="button"
                onClick={() => set("images", [...block.images, { src: "", caption: "" }])}
                className="w-full rounded-lg border border-dashed border-line py-2 text-sm font-medium text-brand-600 hover:border-brand-500"
              >
                + Rasm qo&apos;shish
              </button>
            )}
          </div>
        </div>
      );
    case "text":
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
    case "shop":
      return (
        <div className="space-y-3">
          <TextField label="Sarlavha" value={block.heading} onChange={(v) => set("heading", v)} />
          <TextField label="Qisqa tavsif" value={block.subheading} onChange={(v) => set("subheading", v)} />
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="Qaysi mahsulotlar"
              value={block.category ?? ""}
              options={[["", "Hammasi"], ...categories.map((c) => [c, c] as [string, string])]}
              onChange={(v) => set("category", v)}
            />
            <SelectField
              label="Nechta ko'rsatish"
              value={String(block.limit ?? 0)}
              options={[["0", "Hammasi"], ["4", "4 ta"], ["6", "6 ta"], ["8", "8 ta"], ["12", "12 ta"]]}
              onChange={(v) => set("limit", Number(v))}
            />
          </div>
          <Segmented label="Kompyuterda ustunlar" value={block.columns ?? "4"} options={[["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]]} onChange={(v) => set("columns", v)} />
          <Segmented label="Telefonda ustunlar" value={block.mobileColumns ?? "2"} options={[["1", "1"], ["2", "2"]]} onChange={(v) => set("mobileColumns", v)} />
          <Segmented
            label="Rasm shakli"
            value={block.ratio ?? "square"}
            options={[["square", "Kvadrat"], ["portrait", "Tik"], ["landscape", "Yotiq"]]}
            onChange={(v) => set("ratio", v)}
          />
          <Segmented label="Kartochka" value={block.card ?? "border"} options={[["border", "Chegarali"], ["shadow", "Soyali"], ["flat", "Oddiy"], ["market", "Marketpleys"]]} onChange={(v) => set("card", v)} />
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <CheckField label="Tavsifni ko'rsatish" checked={block.showDescription ?? false} onChange={(v) => set("showDescription", v)} />
            <CheckField label="Qidiruv va kategoriyalar" checked={block.showSearch ?? true} onChange={(v) => set("showSearch", v)} />
          </div>
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
            Mahsulotlar, narxlar va qoldiq{" "}
            <Link href="/dashboard/products" target="_blank" className="font-semibold underline">
              Mahsulotlar
            </Link>{" "}
            bo&apos;limidan avtomatik olinadi. Mijoz savatga qo&apos;shib buyurtma beradi.
          </p>
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


// ===== Bloklar kutubxonasi =====

const LIBRARY: { label: string; types: BlockType[] }[] = [
  { label: "Bosh banner", types: ["hero"] },
  { label: "Do'kon / katalog", types: ["shop"] },
  { label: "Afzalliklar", types: ["features"] },
  { label: "Biz haqimizda", types: ["about"] },
  { label: "Rasm va galereya", types: ["image", "gallery"] },
  { label: "Matn", types: ["text"] },
  { label: "Mijozlar fikri", types: ["testimonials"] },
  { label: "Savol-javob", types: ["faq"] },
  { label: "Chaqiriq (tugma)", types: ["cta"] },
  { label: "Aloqa", types: ["contact"] },
  { label: "Mahsulotlar (qo'lda)", types: ["products"] },
];

function sampleBlock(type: BlockType, variant: string): Block {
  const b = defaultBlock(type) as Block;
  return { ...b, variant: variant || undefined } as Block;
}

function LibraryModal({
  site,
  shop,
  onPick,
  onClose,
}: {
  site: Site;
  shop?: ShopData | null;
  onPick: (type: BlockType, variant: string) => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState(0);
  const items = LIBRARY[group].types.flatMap((t) => (BLOCK_VARIANTS[t] ?? [{ id: "", label: BLOCK_LABELS[t] }]).map((v) => ({ type: t, variant: v.id, label: v.label })));
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex h-[88dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-brand-700 px-5 py-3 text-white">
          <h2 className="font-semibold">Blok qo&apos;shish</h2>
          <button type="button" onClick={onClose} className="text-2xl leading-none" aria-label="Yopish">
            ×
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-line p-2 sm:w-56 sm:flex-col sm:overflow-y-auto sm:border-r sm:border-b-0">
            {LIBRARY.map((g, i) => (
              <button
                key={g.label}
                type="button"
                onClick={() => setGroup(i)}
                className={`rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap ${i === group ? "bg-brand-600 font-semibold text-white" : "hover:bg-surface"}`}
              >
                {BLOCK_ICONS[g.types[0]]} {g.label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-surface p-4">
            {items.map((it) => (
              <button
                key={`${it.type}-${it.variant}`}
                type="button"
                onClick={() => onPick(it.type, it.variant)}
                className="group block w-full overflow-hidden rounded-xl border-2 border-transparent bg-white text-left shadow-sm transition hover:border-brand-500"
              >
                <div className="relative h-52 overflow-hidden">
                  <div className="pointer-events-none absolute top-0 left-0 w-[1200px] origin-top-left scale-[0.55] sm:scale-[0.6]">
                    <BlockPreview site={site} block={sampleBlock(it.type, it.variant)} shop={shop ? { ...shop, embedded: true } : undefined} />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-line px-4 py-2 text-sm">
                  <span className="font-medium">{it.label}</span>
                  <span className="font-semibold text-brand-600 opacity-0 transition group-hover:opacity-100">+ Qo&apos;shish</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** "items.0.title" kabi yo'l bo'yicha qiymatni o'zgartiradi (nusxa qaytaradi) */
function setPath<T>(obj: T, parts: string[], value: unknown): T {
  if (!parts.length) return value as T;
  const [head, ...rest] = parts;
  if (Array.isArray(obj)) {
    const i = Number(head);
    const copy = obj.slice();
    copy[i] = setPath(copy[i], rest, value);
    return copy as T;
  }
  const o = (obj ?? {}) as Record<string, unknown>;
  return { ...o, [head]: setPath(o[head], rest, value) } as T;
}

// ===== Asosiy tahrirlovchi =====

export function SiteEditor({
  projectId,
  initialSite,
  initialVersion,
  aiEnabled,
  publishStatus,
  shop,
}: {
  projectId: string;
  initialSite: Site;
  initialVersion: number;
  aiEnabled: boolean;
  publishStatus: PublishStatus;
  shop?: ShopData | null;
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
  const categories = useMemo(() => [...new Set((shop?.products ?? []).map((p) => p.category).filter(Boolean))].sort(), [shop]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [library, setLibrary] = useState<null | { afterId: string | null }>(null);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [fullscreen, setFullscreen] = useState(true);
  const frameBody = useRef<HTMLElement | null>(null);
  // Orqaga / oldinga (undo / redo)
  const past = useRef<Site[]>([]);
  const future = useRef<Site[]>([]);
  const lastPush = useRef(0);
  const [, setHistoryTick] = useState(0);

  // Mahsulotlar qo'shilgan, lekin saytda hali eski qo'lda yozilgan "Mahsulotlar" bloki turgan bo'lsa —
  // uni jonli katalogga aylantiramiz (sarlavhasi saqlanadi)
  useEffect(() => {
    if (!shop?.products.length) return;
    const hasShop = site.pages.some((p) => p.blocks.some((b) => b.type === "shop"));
    if (hasShop) return;
    const legacy = site.pages.flatMap((p) => p.blocks).find((b) => b.type === "products");
    if (!legacy || legacy.type !== "products") return;
    update((s) => ({
      ...s,
      pages: s.pages.map((p) => ({
        ...p,
        blocks: p.blocks.map((b) =>
          b.id === legacy.id && b.type === "products"
            ? ({ type: "shop", id: b.id, style: b.style, heading: b.heading || "Katalog", subheading: b.subheading } as Block)
            : b,
        ),
      })),
    }));
    setOpenBlock(legacy.id);
    setStatus({ kind: "ok", text: "Namuna mahsulotlar jonli katalogga almashtirildi — saqlang" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectBlock(id: string, from: "list" | "preview") {
    setOpenBlock(id);
    if (from === "preview") {
      setMobileView("edit");
      setTimeout(() => document.getElementById(`blk-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    } else {
      frameBody.current?.querySelector(`[data-block-id="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function moveBlock(id: string, dir: -1 | 1) {
    updateBlocks((b) => {
      const i = b.findIndex((x) => x.id === id);
      return i < 0 ? b : move(b, i, dir);
    });
  }

  function duplicateBlock(id: string) {
    const nid = randomId();
    updateBlocks((b) => {
      const i = b.findIndex((x) => x.id === id);
      if (i < 0) return b;
      const copy = b.slice();
      copy.splice(i + 1, 0, { ...structuredClone(b[i]), id: nid });
      return copy;
    });
    setOpenBlock(nid);
  }

  function deleteBlock(id: string) {
    const b = page.blocks.find((x) => x.id === id);
    if (!b || !window.confirm(`"${BLOCK_LABELS[b.type]}" bloki o'chirilsinmi?`)) return;
    updateBlocks((list) => list.filter((x) => x.id !== id));
  }

  function dropAt(target: number) {
    if (dragIdx === null || dragIdx === target) return;
    updateBlocks((b) => {
      const copy = b.slice();
      const [item] = copy.splice(dragIdx, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  }

  // Saqlanmagan o'zgarishlar bilan sahifadan chiqishda ogohlantirish
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function update(mutator: (draft: Site) => Site) {
    setSite((s) => {
      const now = Date.now();
      // Ketma-ket tez o'zgarishlar (matn yozish) bitta qadam hisoblanadi
      if (now - lastPush.current > 800 && past.current[past.current.length - 1] !== s) {
        past.current.push(s);
        if (past.current.length > 80) past.current.shift();
      }
      lastPush.current = now;
      future.current = [];
      return mutator(s);
    });
    setHistoryTick((t) => t + 1);
    setDirty(true);
    setStatus(null);
  }

  function undo() {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(site);
    lastPush.current = 0;
    setSite(prev);
    setDirty(true);
    setHistoryTick((t) => t + 1);
  }

  function redo() {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(site);
    lastPush.current = 0;
    setSite(next);
    setDirty(true);
    setHistoryTick((t) => t + 1);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function setHeader(patch: Partial<NonNullable<Site["header"]>>) {
    update((s) => ({ ...s, header: { logo: "", showNav: true, ctaText: "", ctaLink: "", ...(s.header ?? {}), ...patch } }));
  }

  function setField(blockId: string, path: string, value: string) {
    updateBlocks((b) => b.map((x) => (x.id === blockId ? setPath(x, path.split("."), value) : x)));
  }

  function addBlockAt(type: BlockType, variant: string, afterId: string | null) {
    const nb = { ...defaultBlock(type), variant: variant || undefined } as Block;
    updateBlocks((b) => {
      const i = afterId ? b.findIndex((x) => x.id === afterId) : -1;
      if (i < 0) return [...b, nb];
      const copy = b.slice();
      copy.splice(i + 1, 0, nb);
      return copy;
    });
    setOpenBlock(nb.id);
    setLibrary(null);
    setTimeout(() => frameBody.current?.querySelector(`[data-block-id="${nb.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
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

  /** Nashrdan oldin saqlash (Promise qaytaradi) */
  async function saveNow(): Promise<boolean> {
    const result = await saveWebsiteAction(projectId, site, version);
    if (result.ok) {
      setVersion(result.data.version);
      setDirty(false);
      return true;
    }
    setStatus({ kind: "error", text: result.error });
    return false;
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

  const labels = useMemo(() => Object.fromEntries(page.blocks.map((b) => [b.id, `${BLOCK_ICONS[b.type]} ${BLOCK_LABELS[b.type]}`])), [page]);

  const preview = (
    <div className="h-full overflow-hidden rounded-xl border border-line bg-[#e9edf5] shadow-sm">
      <FramePreview
        width={device === "desktop" ? "100%" : device === "tablet" ? 820 : 390}
        onBody={(b) => {
          frameBody.current = b;
        }}
      >
        <div
          onClickCapture={(e) => {
            // Tahrirlovchi ichida havolalar boshqa sahifaga olib ketmasin
            if ((e.target as HTMLElement).closest("a")) e.preventDefault();
          }}
        >
          <SiteRenderer
            site={site}
            page={page}
            shop={shop ?? undefined}
            editing={{
              selectedId: openBlock,
              labels,
              onSelect: (id) => selectBlock(id, "preview"),
              onMove: moveBlock,
              onDuplicate: duplicateBlock,
              onDelete: deleteBlock,
              onField: setField,
              onAddAfter: (id) => setLibrary({ afterId: id }),
            }}
          />
        </div>
      </FramePreview>
    </div>
  );

  const tb = "grid size-9 place-items-center rounded-lg text-base hover:bg-surface disabled:opacity-30";
  return (
    <div className={fullscreen ? "fixed inset-0 z-50 flex flex-col gap-2 bg-[#eef1f7] p-2 sm:p-3" : "space-y-4"}>
      {/* Yuqori panel */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-2 sm:p-3">
        {fullscreen && (
          <Link href="/dashboard/sites" className="rounded-lg px-2 py-1.5 text-sm font-medium text-muted hover:bg-surface hover:text-ink" title="Saytlar ro'yxatiga">
            ← Chiqish
          </Link>
        )}
        <div className="flex items-center border-x border-line px-1">
          <button type="button" className={tb} disabled={!past.current.length} onClick={undo} title="Orqaga (Ctrl+Z)" aria-label="Orqaga">
            ↶
          </button>
          <button type="button" className={tb} disabled={!future.current.length} onClick={redo} title="Oldinga (Ctrl+Y)" aria-label="Oldinga">
            ↷
          </button>
        </div>
        <div className="hidden items-center rounded-lg bg-surface p-0.5 lg:flex">
          {(
            [
              ["desktop", "🖥", "Kompyuter"],
              ["tablet", "📟", "Planshet"],
              ["mobile", "📱", "Telefon"],
            ] as const
          ).map(([d, icon, label]) => (
            <button
              key={d}
              type="button"
              title={label}
              onClick={() => setDevice(d)}
              className={`rounded-md px-2.5 py-1 text-sm ${device === d ? "bg-white shadow-sm" : "opacity-60 hover:opacity-100"}`}
            >
              {icon}
            </button>
          ))}
        </div>
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
        <PublishPanel projectId={projectId} initialStatus={publishStatus} dirty={dirty} saveFirst={saveNow} />
        <button type="button" className={tb} onClick={() => setFullscreen((f) => !f)} title={fullscreen ? "Oddiy ko'rinish" : "To'liq ekran"}>
          {fullscreen ? "⤡" : "⤢"}
        </button>
      </div>

      {/* AI bilan tahrirlash (faqat AI yoqilganda) */}
      {aiEnabled && (
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
      )}

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

      <div className={`grid gap-3 lg:grid-cols-[380px_1fr] ${fullscreen ? "min-h-0 flex-1" : ""}`}>
        {/* Chap panel: sozlamalar va bloklar */}
        <div className={`space-y-3 ${fullscreen ? "min-h-0 overflow-y-auto pr-1 pb-6" : ""} ${mobileView === "preview" ? "hidden lg:block" : ""}`}>
          <details className="rounded-xl border border-line bg-white p-4" open={false}>
            <summary className="cursor-pointer text-sm font-semibold">🎨 Sayt sozlamalari va ranglar</summary>
            <div className="mt-4 space-y-3">
              <TextField label="Sayt nomi" value={site.name} onChange={(v) => update((s) => ({ ...s, name: v }))} />
              <TextField label="Shior" value={site.tagline} onChange={(v) => update((s) => ({ ...s, tagline: v }))} />
              <div className="space-y-2 rounded-lg border border-line p-3">
                <p className="text-xs font-semibold text-muted">Yuqori qism (menyu)</p>
                <ImageField
                  label="Logotip"
                  value={site.header?.logo ?? ""}
                  onChange={(v) => setHeader({ logo: v })}
                />
                <CheckField
                  label="Sahifalar menyusini ko'rsatish"
                  checked={site.header?.showNav ?? true}
                  onChange={(v) => setHeader({ showNav: v })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <TextField
                    label="Tugma matni"
                    value={site.header?.ctaText ?? ""}
                    placeholder="Bog'lanish"
                    onChange={(v) => setHeader({ ctaText: v })}
                  />
                  <TextField
                    label="Tugma havolasi"
                    value={site.header?.ctaLink ?? ""}
                    placeholder="#katalog"
                    onChange={(v) => setHeader({ ctaLink: v })}
                  />
                </div>
                <Segmented
                  label="Menyu dizayni"
                  value={site.header?.variant ?? "classic"}
                  options={[
                    ["classic", "Oddiy"],
                    ["centered", "Markazda"],
                    ["dark", "Rangli"],
                    ["market", "Qidiruvli"],
                  ]}
                  onChange={(v) => setHeader({ variant: v })}
                />
              </div>
              <div className="space-y-2 rounded-lg border border-line p-3">
                <p className="text-xs font-semibold text-muted">Pastki qism (footer)</p>
                <Segmented
                  label="Dizayn"
                  value={site.footer?.variant ?? "simple"}
                  options={[
                    ["simple", "Oddiy"],
                    ["columns", "Ustunli"],
                    ["dark", "Qorong'i"],
                  ]}
                  onChange={(v) => update((s) => ({ ...s, footer: { variant: v, text: s.footer?.text ?? "" } }))}
                />
                <TextField
                  label="Matn"
                  value={site.footer?.text ?? ""}
                  placeholder={site.tagline || "Qisqa ma'lumot"}
                  onChange={(v) => update((s) => ({ ...s, footer: { variant: s.footer?.variant ?? "simple", text: v } }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["primary", "accent"] as const).map((k) => (
                  <label key={k} className="block">
                    <span className="mb-1 block text-xs font-medium text-muted">{k === "primary" ? "Asosiy rang" : "Tugma rangi"}</span>
                    <span className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5">
                      <input
                        type="color"
                        value={site.theme[k]}
                        onChange={(e) => update((s) => ({ ...s, theme: { ...s.theme, [k]: e.target.value } as Site["theme"] }))}
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
                <div
                  key={block.id}
                  id={`blk-${block.id}`}
                  draggable
                  onDragStart={(e) => {
                    setDragIdx(i);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverIdx(i);
                  }}
                  onDragLeave={() => setOverIdx((o) => (o === i ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    dropAt(i);
                    setDragIdx(null);
                    setOverIdx(null);
                  }}
                  onDragEnd={() => {
                    setDragIdx(null);
                    setOverIdx(null);
                  }}
                  className={`scroll-mt-4 rounded-xl border bg-white transition ${open ? "border-brand-500 shadow-sm" : "border-line"} ${
                    overIdx === i && dragIdx !== null && dragIdx !== i ? "ring-2 ring-accent-500" : ""
                  } ${dragIdx === i ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center gap-1 px-2 py-2">
                    <span className="cursor-grab px-1 text-muted select-none active:cursor-grabbing" title="Sudrab joyini o'zgartiring">
                      ⋮⋮
                    </span>
                    <button
                      type="button"
                      onClick={() => (open ? setOpenBlock(null) : selectBlock(block.id, "list"))}
                      className="min-w-0 flex-1 truncate text-left text-sm font-semibold"
                      aria-expanded={open}
                    >
                      <span className="mr-1">{BLOCK_ICONS[block.type]}</span>
                      {BLOCK_LABELS[block.type]}
                      {"heading" in block && block.heading && <span className="ml-2 font-normal text-muted">· {block.heading}</span>}
                    </button>
                    <button type="button" className={smallBtn} disabled={i === 0} onClick={() => moveBlock(block.id, -1)} aria-label="Yuqoriga">
                      ↑
                    </button>
                    <button type="button" className={smallBtn} disabled={i === page.blocks.length - 1} onClick={() => moveBlock(block.id, 1)} aria-label="Pastga">
                      ↓
                    </button>
                    <button type="button" className={smallBtn} onClick={() => duplicateBlock(block.id)} aria-label="Nusxalash" title="Nusxalash">
                      ⧉
                    </button>
                    <button type="button" className={`${smallBtn} text-red-600`} onClick={() => deleteBlock(block.id)} aria-label="O'chirish">
                      ✕
                    </button>
                  </div>
                  {open && (
                    <div className="border-t border-line p-3">
                      <BlockForm
                        key={block.id}
                        block={block}
                        categories={categories}
                        onChange={(nb) => updateBlocks((b) => b.map((x) => (x.id === block.id ? nb : x)))}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setLibrary({ afterId: openBlock })}
            className="w-full rounded-xl border-2 border-dashed border-brand-500/40 bg-white py-3 text-sm font-semibold text-brand-700 hover:border-brand-500 hover:bg-brand-50"
          >
            + Blok qo&apos;shish
          </button>
          <p className="px-1 text-xs text-muted">💡 Saytdagi matnni bosib shu joyida yozing. Blokni bosib tanlang, ⋮⋮ dan sudrab joyini o&apos;zgartiring. Ctrl+Z — orqaga.</p>
        </div>

        {/* O'ng panel: jonli ko'rinish */}
        <div className={`${fullscreen ? "min-h-0 lg:h-full" : "lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)]"} ${mobileView === "edit" ? "hidden lg:block" : "h-[75dvh]"}`}>
          {preview}
        </div>
      </div>

      {library && (
        <LibraryModal site={site} shop={shop} onClose={() => setLibrary(null)} onPick={(type, variant) => addBlockAt(type, variant, library.afterId)} />
      )}
    </div>
  );
}
