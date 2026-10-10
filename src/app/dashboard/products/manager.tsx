"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import type { Product } from "@/actions/shop";
import { formatMoney } from "@/lib/shop/format";
import { uploadImage } from "@/lib/upload-image";
import { deleteProductAction, saveProductAction, setProductActiveAction } from "./actions";

const input =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

type Draft = {
  id?: string;
  name: string;
  description: string;
  price: string;
  oldPrice: string;
  category: string;
  imageUrl: string;
  emoji: string;
  sku: string;
  stock: string;
  isActive: boolean;
};

const emptyDraft: Draft = { name: "", description: "", price: "", oldPrice: "", category: "", imageUrl: "", emoji: "", sku: "", stock: "", isActive: true };

function toDraft(p: Product): Draft {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: String(p.price),
    oldPrice: p.old_price === null ? "" : String(p.old_price),
    category: p.category,
    imageUrl: p.image_url ?? "",
    emoji: p.emoji,
    sku: p.sku ?? "",
    stock: p.stock === null ? "" : String(p.stock),
    isActive: p.is_active,
  };
}

const digits = (v: string) => v.replace(/\D/g, "");
const spaced = (v: string) => (v ? v.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "");

function Thumb({ p, size = "size-12" }: { p: { image_url: string | null; emoji: string; name: string }; size?: string }) {
  return p.image_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.image_url} alt={p.name} className={`${size} shrink-0 rounded-lg object-cover`} />
  ) : (
    <div className={`${size} grid shrink-0 place-items-center rounded-lg bg-surface text-2xl`}>{p.emoji || "📦"}</div>
  );
}

export function ProductsManager({ initial }: { initial: Product[] }) {
  const [products, setProducts] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [shown, setShown] = useState(100);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);
  const visible = products.filter(
    (p) => (!category || p.category === category) && (!query || p.name.toLowerCase().includes(query.toLowerCase())),
  );
  const activeCount = products.filter((p) => p.is_active).length;

  function upsertLocal(p: Product) {
    setProducts((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list]));
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Mahsulotlar</h1>
          <p className="mt-1 text-muted">
            {products.length} ta mahsulot · {activeCount} tasi sotuvda. Saytingiz va bot Mini App&apos;ida avtomatik chiqadi.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft({ ...emptyDraft })}
          className="rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-600"
        >
          + Mahsulot qo&apos;shish
        </button>
      </div>

      {products.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Qidirish…" className={`${input} max-w-xs`} />
          {categories.length > 0 && (
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${input} w-auto`}>
              <option value="">Barcha kategoriyalar</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
        {products.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-4xl">🛍</p>
            <p className="mt-3 font-semibold">Hali mahsulot yo&apos;q</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Birinchi mahsulotni qo&apos;shing — u saytingizda savat bilan chiqadi va mijozlar Telegram bot orqali buyurtma bera oladi.
            </p>
            <button
              type="button"
              onClick={() => setDraft({ ...emptyDraft })}
              className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              + Mahsulot qo&apos;shish
            </button>
          </div>
        ) : visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-muted">Hech narsa topilmadi</p>
        ) : (
          <ul className="divide-y divide-line">
            {visible.slice(0, shown).map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                onEdit={() => setDraft(toDraft(p))}
                onChange={upsertLocal}
                onDeleted={() => setProducts((l) => l.filter((x) => x.id !== p.id))}
              />
            ))}
          </ul>
        )}
        {visible.length > shown && (
          <button type="button" onClick={() => setShown((n) => n + 100)} className="w-full border-t border-line py-3 text-sm font-medium text-brand-600 hover:bg-surface">
            Yana ko&apos;rsatish ({visible.length - shown})
          </button>
        )}
      </div>

      {products.length > 0 && (
        <p className="mt-4 text-sm text-muted">
          Buyurtmalar{" "}
          <Link href="/dashboard/orders" className="font-medium text-brand-600 hover:underline">
            Buyurtmalar
          </Link>{" "}
          bo&apos;limiga tushadi. Yetkazish narxi va olib ketish manzili —{" "}
          <Link href="/dashboard/orders/settings" className="font-medium text-brand-600 hover:underline">
            do&apos;kon sozlamalarida
          </Link>
          .
        </p>
      )}

      {draft && (
        <ProductEditor
          draft={draft}
          categories={categories}
          onClose={() => setDraft(null)}
          onSaved={(p) => {
            upsertLocal(p);
            setDraft(null);
          }}
        />
      )}
    </div>
  );
}

function ProductRow({
  product: p,
  onEdit,
  onChange,
  onDeleted,
}: {
  product: Product;
  onEdit: () => void;
  onChange: (p: Product) => void;
  onDeleted: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className={`flex flex-wrap items-center gap-3 px-4 py-3 ${p.is_active ? "" : "opacity-60"}`}>
      <Thumb p={p} />
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className="truncate font-semibold">{p.name}</p>
        <p className="truncate text-sm text-muted">
          {p.external_source === "bito" && <span className="mr-1.5 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700">Bito</span>}
          {p.category || "Kategoriyasiz"}
          {p.stock !== null && <> · qoldiq: {p.stock === 0 ? <span className="text-red-600">tugagan</span> : p.stock}</>}
        </p>
      </button>
      <div className="text-right">
        <p className="font-semibold">{formatMoney(p.price)}</p>
        {p.old_price && <p className="text-xs text-muted line-through">{formatMoney(p.old_price)}</p>}
      </div>
      <div className="flex items-center gap-1">
        <label className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:bg-surface">
          <input
            type="checkbox"
            checked={p.is_active}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.checked;
              start(async () => {
                setError(null);
                const r = await setProductActiveAction(p.id, v);
                if (r.ok) onChange({ ...p, is_active: v });
                else setError(r.error);
              });
            }}
          />
          Sotuvda
        </label>
        <button type="button" onClick={onEdit} className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-surface">
          Tahrirlash
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`"${p.name}" o'chirilsinmi?`)) return;
            start(async () => {
              const r = await deleteProductAction(p.id);
              if (r.ok) onDeleted();
              else setError(r.error);
            });
          }}
          className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          O&apos;chirish
        </button>
      </div>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </li>
  );
}

function ProductEditor({
  draft: initial,
  categories,
  onClose,
  onSaved,
}: {
  draft: Draft;
  categories: string[];
  onClose: () => void;
  onSaved: (p: Product) => void;
}) {
  const [d, setD] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    const r = await uploadImage(file);
    setUploading(false);
    if (r.ok) set("imageUrl", r.url);
    else setError(r.error);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      setError(null);
      const r = await saveProductAction({
        id: d.id,
        name: d.name,
        description: d.description,
        price: Number(d.price || 0),
        oldPrice: d.oldPrice ? Number(d.oldPrice) : null,
        category: d.category,
        imageUrl: d.imageUrl || null,
        emoji: d.emoji,
        sku: d.sku || null,
        stock: d.stock === "" ? null : Number(d.stock),
        isActive: d.isActive,
      });
      if (r.ok) onSaved(r.data);
      else setError(r.error);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[94dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{d.id ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}</h2>
          <button type="button" onClick={onClose} aria-label="Yopish" className="text-2xl leading-none text-muted">
            ×
          </button>
        </div>

        <div className="flex items-start gap-4">
          <div className="shrink-0">
            {d.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.imageUrl} alt="" className="size-24 rounded-xl object-cover" />
            ) : (
              <div className="grid size-24 place-items-center rounded-xl bg-surface text-4xl">{d.emoji || "📦"}</div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface disabled:opacity-50"
              >
                {uploading ? "Yuklanmoqda…" : d.imageUrl ? "Rasmni almashtirish" : "📷 Rasm yuklash"}
              </button>
              {d.imageUrl && (
                <button type="button" onClick={() => set("imageUrl", "")} className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
                  Olib tashlash
                </button>
              )}
            </div>
            {!d.imageUrl && (
              <label className="flex items-center gap-2 text-sm text-muted">
                yoki emoji:
                <input value={d.emoji} onChange={(e) => set("emoji", e.target.value.slice(0, 8))} className={`${input} w-20`} placeholder="👕" />
              </label>
            )}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Nomi *</span>
          <input value={d.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} className={input} autoFocus />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Narxi (so&apos;m) *</span>
            <input value={spaced(d.price)} onChange={(e) => set("price", digits(e.target.value))} required inputMode="numeric" className={input} placeholder="120 000" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Eski narx (chegirma)</span>
            <input value={spaced(d.oldPrice)} onChange={(e) => set("oldPrice", digits(e.target.value))} inputMode="numeric" className={input} placeholder="ixtiyoriy" />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Tavsif</span>
          <textarea value={d.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} rows={3} className={input} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Kategoriya</span>
            <input value={d.category} onChange={(e) => set("category", e.target.value)} maxLength={60} list="product-categories" className={input} placeholder="Masalan: Ko'ylaklar" />
            <datalist id="product-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Qoldiq (dona)</span>
            <input value={d.stock} onChange={(e) => set("stock", digits(e.target.value))} inputMode="numeric" className={input} placeholder="cheklanmagan" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Artikul (SKU)</span>
            <input value={d.sku} onChange={(e) => set("sku", e.target.value)} maxLength={64} className={input} placeholder="ixtiyoriy" />
          </label>
          <label className="mt-6 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={d.isActive} onChange={(e) => set("isActive", e.target.checked)} />
            Sotuvda (saytda ko&apos;rinadi)
          </label>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:bg-surface">
            Bekor qilish
          </button>
          <button
            type="submit"
            disabled={pending || uploading}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </form>
    </div>
  );
}
