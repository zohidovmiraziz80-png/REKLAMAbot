import { Fragment, type CSSProperties, type ReactNode } from "react";
import { DEFAULT_BLOCK_STYLE, type Block, type BlockStyle, type Site, type SitePage } from "@/lib/site/schema";
import { instagramUrl, phoneUrl, safeHref, telegramUrl } from "@/lib/site/safe";
import type { ShopData } from "@/lib/shop/types";
import { ShopPlaceholder, ShopSection, type ShopLayout } from "./shop";

/**
 * Sayt tuzilmasini (JSON) xavfsiz React komponentlarga aylantiradi.
 * HTML hech qachon to'g'ridan-to'g'ri qo'yilmaydi — faqat matn sifatida chiqadi.
 * Server va brauzerda ishlaydi (hook'lar yo'q; do'kon bloki alohida client komponent).
 * Tahrirlovchida `editing` beriladi — bloklarni bosib tanlash va ko'chirish mumkin.
 */

const FONTS: Record<Site["theme"]["font"], string> = {
  modern: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  classic: 'Georgia, "Times New Roman", ui-serif, serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, sans-serif',
};

const RADIUS: Record<Site["theme"]["radius"], string> = { sharp: "4px", soft: "14px", round: "28px" };

function themeVars(site: Site): CSSProperties {
  const dark = site.theme.mode === "dark";
  const heading = dark ? "#ffffff" : site.theme.primary;
  const muted = dark ? "#a5adc2" : "#5b6475";
  return {
    ["--s-primary" as string]: site.theme.primary,
    ["--s-accent" as string]: site.theme.accent,
    ["--s-bg" as string]: dark ? "#0b1020" : "#ffffff",
    ["--s-surface" as string]: dark ? "#141a2e" : "#f5f7fb",
    ["--s-text" as string]: dark ? "#eef1f8" : "#111827",
    ["--s-muted" as string]: muted,
    ["--s-muted0" as string]: muted,
    ["--s-line" as string]: dark ? "#263050" : "#e5e8f0",
    ["--s-heading" as string]: heading,
    ["--s-heading0" as string]: heading,
    ["--s-radius" as string]: RADIUS[site.theme.radius],
    fontFamily: FONTS[site.theme.font],
    background: "var(--s-bg)",
    color: "var(--s-text)",
  } as CSSProperties;
}

/** Rangli fon ustida kartochkalar o'z ranglarini saqlab qolishi uchun */
const BASE_CSS = `.s-card{color:var(--s-text);--s-heading:var(--s-heading0);--s-muted:var(--s-muted0)}`;

const container = "mx-auto w-full max-w-5xl px-5";
const sectionPad = "py-14 sm:py-20";
const h2 = "text-2xl sm:text-3xl font-bold tracking-tight text-[color:var(--s-heading)]";
const card = "s-card rounded-[var(--s-radius)] border border-[color:var(--s-line)] bg-[color:var(--s-surface)] p-5";

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

const ON_DARK: CSSProperties = {
  color: "#ffffff",
  ["--s-heading" as string]: "#ffffff",
  ["--s-muted" as string]: "rgba(255,255,255,0.82)",
} as CSSProperties;

/** Blok dizaynini (fon, bo'shliq) o'rab turuvchi elementga aylantiradi */
function frame(block: Block, st: BlockStyle): { className: string; style: CSSProperties } {
  const classes: string[] = [];
  let style: CSSProperties = {};
  if (st.bg !== "default") {
    classes.push("[&>section]:bg-transparent!");
    switch (st.bg) {
      case "surface":
        style = { background: "var(--s-surface)" };
        break;
      case "primary":
        style = { background: "var(--s-primary)", ...ON_DARK };
        break;
      case "accent":
        style = { background: "var(--s-accent)", ...ON_DARK };
        break;
      case "dark":
        style = { background: "#0b1020", ...ON_DARK };
        break;
      case "custom":
        style = { background: st.bgColor, ...(isLight(st.bgColor) ? {} : ON_DARK) };
        break;
      case "image":
        style = st.bgImage
          ? {
              backgroundImage: `linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.45)),url("${st.bgImage}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              ...ON_DARK,
            }
          : {};
        break;
    }
  }
  const hero = block.type === "hero";
  if (st.pad === "sm") classes.push(hero ? "[&>section>div]:py-12! sm:[&>section>div]:py-14!" : "[&>section]:py-8! sm:[&>section]:py-10!");
  if (st.pad === "lg") classes.push(hero ? "[&>section>div]:py-28! sm:[&>section>div]:py-40!" : "[&>section]:py-20! sm:[&>section]:py-32!");
  return { className: classes.join(" "), style };
}

function Button({ href, children, variant = "accent" }: { href?: string; children: ReactNode; variant?: "accent" | "light" }) {
  if (!children) return null;
  const cls =
    variant === "accent"
      ? "bg-[color:var(--s-accent)] text-white hover:brightness-110"
      : "bg-white text-[color:var(--s-primary)] hover:brightness-95";
  return (
    <a
      href={href ?? "#"}
      className={`inline-flex items-center justify-center rounded-[var(--s-radius)] px-6 py-3 font-semibold shadow-sm transition ${cls}`}
      {...(href?.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

function anchorFor(block: Block, firstOfType: boolean) {
  if (!firstOfType) return block.id;
  if (block.type === "contact") return "aloqa";
  if (block.type === "products") return "mahsulotlar";
  if (block.type === "shop") return "katalog";
  if (block.type === "faq") return "savollar";
  if (block.type === "about") return "biz-haqimizda";
  if (block.type === "gallery") return "galereya";
  return block.id;
}

function shopLayout(block: Extract<Block, { type: "shop" }>): ShopLayout {
  return {
    category: block.category ?? "",
    limit: block.limit ?? 0,
    columns: block.columns ?? "4",
    mobileColumns: block.mobileColumns ?? "2",
    card: block.card ?? "border",
    ratio: block.ratio ?? "square",
    showDescription: block.showDescription ?? false,
    showSearch: block.showSearch ?? true,
    align: block.style?.align ?? "center",
  };
}

function BlockView({ block, basePath, anchor, shop, st }: { block: Block; basePath: string; anchor: string; shop?: ShopData; st: BlockStyle }) {
  const center = st.align !== "left";
  const hc = center ? "text-center" : "";
  const sub = center ? "mx-auto text-center" : "";

  switch (block.type) {
    case "shop":
      return shop && (shop.products.length > 0 || !shop.embedded) ? (
        <ShopSection shop={shop} heading={block.heading} subheading={block.subheading} anchor={anchor} layout={shopLayout(block)} />
      ) : (
        <ShopPlaceholder heading={block.heading} subheading={block.subheading} anchor={anchor} />
      );

    case "hero": {
      const side = !!block.image && block.imageMode === "side";
      const bgImage = !!block.image && !side;
      const heroCenter = block.align === "center" && !side;
      return (
        <section
          id={anchor}
          className="bg-[color:var(--s-primary)] text-white"
          style={bgImage ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.35)),url("${block.image}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          <div className={`${container} py-20 sm:py-28 ${side ? "grid items-center gap-10 md:grid-cols-2" : ""} ${heroCenter ? "text-center" : ""}`}>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-5xl">{block.heading}</h1>
              {block.subheading && (
                <p className={`mt-5 text-lg text-white/85 text-pretty ${heroCenter ? "mx-auto max-w-2xl" : "max-w-2xl"}`}>{block.subheading}</p>
              )}
              {block.ctaText && (
                <div className="mt-8">
                  <Button href={safeHref(block.ctaLink, basePath)}>{block.ctaText}</Button>
                </div>
              )}
            </div>
            {side && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={block.image} alt="" className="aspect-[4/3] w-full rounded-[var(--s-radius)] object-cover shadow-2xl" />
            )}
          </div>
        </section>
      );
    }

    case "features":
      return (
        <section id={anchor} className={sectionPad}>
          <div className={container}>
            {block.heading && <h2 className={`${h2} ${hc}`}>{block.heading}</h2>}
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {block.items.map((it, i) => (
                <div key={i} className={card}>
                  {it.icon && <div className="text-3xl">{it.icon}</div>}
                  <h3 className="mt-3 text-lg font-semibold">{it.title}</h3>
                  <p className="mt-1.5 text-[color:var(--s-muted)]">{it.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );

    case "products":
      return (
        <section id={anchor} className={`${sectionPad} bg-[color:var(--s-surface)]`}>
          <div className={container}>
            {block.heading && <h2 className={`${h2} ${hc}`}>{block.heading}</h2>}
            {block.subheading && <p className={`mt-3 max-w-2xl text-[color:var(--s-muted)] ${sub}`}>{block.subheading}</p>}
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {block.items.map((it, i) => (
                <div key={i} className="s-card relative flex flex-col rounded-[var(--s-radius)] border border-[color:var(--s-line)] bg-[color:var(--s-bg)] p-5">
                  {it.badge && (
                    <span className="absolute top-4 right-4 rounded-full bg-[color:var(--s-accent)] px-2.5 py-0.5 text-xs font-semibold text-white">
                      {it.badge}
                    </span>
                  )}
                  <div className="grid h-28 place-items-center rounded-[calc(var(--s-radius)*0.7)] bg-[color:var(--s-surface)] text-5xl">
                    {it.emoji || "📦"}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{it.name}</h3>
                  {it.description && <p className="mt-1 flex-1 text-sm text-[color:var(--s-muted)]">{it.description}</p>}
                  <p className="mt-3 text-lg font-bold text-[color:var(--s-heading)]">{it.price || "Narxi so'rov bo'yicha"}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );

    case "image": {
      if (!block.src) {
        return (
          <section id={anchor} className="py-10">
            <div className={`${container} grid h-48 place-items-center rounded-[var(--s-radius)] border-2 border-dashed border-[color:var(--s-line)] text-[color:var(--s-muted)]`}>
              🖼 Rasm yuklang
            </div>
          </section>
        );
      }
      const href = safeHref(block.link, basePath);
      const img = (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.src}
          alt={block.alt || block.caption || ""}
          loading="lazy"
          className={`w-full object-cover ${block.width === "full" ? "max-h-[70vh]" : "rounded-[var(--s-radius)]"}`}
        />
      );
      return (
        <section id={anchor} className={block.width === "full" ? "py-0" : "py-10"}>
          <figure className={block.width === "full" ? "" : container}>
            {href ? (
              <a href={href} {...(href.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {img}
              </a>
            ) : (
              img
            )}
            {block.caption && <figcaption className={`mt-3 text-sm text-[color:var(--s-muted)] ${hc} ${block.width === "full" ? "px-5" : ""}`}>{block.caption}</figcaption>}
          </figure>
        </section>
      );
    }

    case "gallery": {
      const cols = { "2": "grid-cols-2", "3": "grid-cols-2 sm:grid-cols-3", "4": "grid-cols-2 sm:grid-cols-4" }[block.columns];
      const imgs = block.images.filter((i) => i.src);
      return (
        <section id={anchor} className={sectionPad}>
          <div className={container}>
            {block.heading && <h2 className={`${h2} ${hc}`}>{block.heading}</h2>}
            {imgs.length ? (
              <div className={`mt-8 grid gap-3 ${cols}`}>
                {imgs.map((im, i) => (
                  <figure key={i} className="overflow-hidden rounded-[var(--s-radius)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.src} alt={im.caption} loading="lazy" className="aspect-square w-full object-cover transition duration-300 hover:scale-105" />
                    {im.caption && <figcaption className="mt-1.5 text-sm text-[color:var(--s-muted)]">{im.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            ) : (
              <p className={`mt-6 text-[color:var(--s-muted)] ${hc}`}>Rasmlar qo&apos;shilmagan</p>
            )}
          </div>
        </section>
      );
    }

    case "text":
      return (
        <section id={anchor} className={sectionPad}>
          <div className={`${container} max-w-3xl ${hc}`}>
            {block.heading && <h2 className={h2}>{block.heading}</h2>}
            {block.text && <p className="mt-4 text-lg leading-relaxed whitespace-pre-line text-[color:var(--s-muted)]">{block.text}</p>}
          </div>
        </section>
      );

    case "about":
      return (
        <section id={anchor} className={sectionPad}>
          <div className={`${container} ${block.image ? "grid items-center gap-10 md:grid-cols-2" : `max-w-3xl ${hc}`}`}>
            {block.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={block.image} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-[var(--s-radius)] object-cover" />
            )}
            <div>
              {block.heading && <h2 className={h2}>{block.heading}</h2>}
              <p className="mt-5 text-lg leading-relaxed whitespace-pre-line text-[color:var(--s-muted)]">{block.text}</p>
            </div>
          </div>
        </section>
      );

    case "testimonials":
      return (
        <section id={anchor} className={`${sectionPad} bg-[color:var(--s-surface)]`}>
          <div className={container}>
            {block.heading && <h2 className={`${h2} ${hc}`}>{block.heading}</h2>}
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {block.items.map((it, i) => (
                <figure key={i} className="s-card rounded-[var(--s-radius)] border border-[color:var(--s-line)] bg-[color:var(--s-bg)] p-5">
                  <blockquote className="text-[color:var(--s-text)]">“{it.text}”</blockquote>
                  <figcaption className="mt-4 text-sm font-semibold">
                    {it.name}
                    {it.role && <span className="font-normal text-[color:var(--s-muted)]"> · {it.role}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      );

    case "faq":
      return (
        <section id={anchor} className={sectionPad}>
          <div className={`${container} max-w-3xl`}>
            {block.heading && <h2 className={`${h2} ${hc}`}>{block.heading}</h2>}
            <div className="mt-8 space-y-3">
              {block.items.map((it, i) => (
                <details key={i} className={`${card} group`}>
                  <summary className="cursor-pointer list-none font-semibold marker:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {it.q}
                      <span className="text-[color:var(--s-accent)] transition group-open:rotate-45">＋</span>
                    </span>
                  </summary>
                  <p className="mt-3 whitespace-pre-line text-[color:var(--s-muted)]">{it.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      );

    case "cta":
      return (
        <section id={anchor} className="py-14">
          <div className={container}>
            <div className={`rounded-[var(--s-radius)] bg-[color:var(--s-primary)] px-6 py-12 text-white sm:px-12 ${center ? "text-center" : ""}`}>
              <h2 className="text-2xl font-bold sm:text-3xl">{block.heading}</h2>
              {block.text && <p className={`mt-3 max-w-xl text-white/85 ${center ? "mx-auto" : ""}`}>{block.text}</p>}
              <div className="mt-7">
                <Button href={safeHref(block.buttonLink, basePath)}>{block.buttonText}</Button>
              </div>
            </div>
          </div>
        </section>
      );

    case "contact": {
      const tel = phoneUrl(block.phone);
      const tg = telegramUrl(block.telegram);
      const ig = instagramUrl(block.instagram);
      const rows = [
        block.phone && { icon: "📞", label: "Telefon", value: block.phone, href: tel },
        block.telegram && { icon: "✈️", label: "Telegram", value: block.telegram, href: tg },
        block.instagram && { icon: "📸", label: "Instagram", value: block.instagram, href: ig },
        block.address && { icon: "📍", label: "Manzil", value: block.address },
        block.workingHours && { icon: "🕘", label: "Ish vaqti", value: block.workingHours },
      ].filter(Boolean) as { icon: string; label: string; value: string; href?: string }[];

      return (
        <section id={anchor} className={`${sectionPad} bg-[color:var(--s-surface)]`}>
          <div className={`${container} max-w-3xl ${hc}`}>
            {block.heading && <h2 className={h2}>{block.heading}</h2>}
            {block.text && <p className={`mt-3 max-w-xl text-[color:var(--s-muted)] ${center ? "mx-auto" : ""}`}>{block.text}</p>}
            {rows.length ? (
              <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
                {rows.map((r) => {
                  const inner = (
                    <>
                      <span className="text-2xl">{r.icon}</span>
                      <span>
                        <span className="block text-xs text-[color:var(--s-muted)]">{r.label}</span>
                        <span className="font-semibold">{r.value}</span>
                      </span>
                    </>
                  );
                  const cls = `flex items-center gap-3 ${card} bg-[color:var(--s-bg)]`;
                  return r.href ? (
                    <a key={r.label} href={r.href} className={`${cls} hover:border-[color:var(--s-accent)]`} {...(r.href.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                      {inner}
                    </a>
                  ) : (
                    <div key={r.label} className={cls}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>
      );
    }
  }
}

/** Tahrirlovchi rejimi: bloklarni bosib tanlash va tez amallar */
export type EditingHandlers = {
  selectedId: string | null;
  labels: Record<string, string>;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

function EditFrame({ id, index, total, editing, children }: { id: string; index: number; total: number; editing: EditingHandlers; children: ReactNode }) {
  const selected = editing.selectedId === id;
  const tool = "grid size-7 place-items-center rounded-md text-sm hover:bg-white/20 disabled:opacity-30";
  return (
    <div
      data-block-id={id}
      onClick={() => editing.onSelect(id)}
      className={`relative cursor-pointer outline-offset-[-2px] ${selected ? "outline-2 outline-[#f7821b] outline-solid" : "hover:outline-2 hover:outline-[#2457b8]/60 hover:outline-dashed"}`}
    >
      {selected && (
        <div
          className="absolute top-2 right-2 z-20 flex items-center gap-0.5 rounded-lg bg-[#0f2d6b] px-1.5 py-1 text-white shadow-lg"
          style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="px-1.5 text-xs font-semibold">{editing.labels[id]}</span>
          <button type="button" title="Yuqoriga" className={tool} disabled={index === 0} onClick={() => editing.onMove(id, -1)}>
            ↑
          </button>
          <button type="button" title="Pastga" className={tool} disabled={index === total - 1} onClick={() => editing.onMove(id, 1)}>
            ↓
          </button>
          <button type="button" title="Nusxalash" className={tool} onClick={() => editing.onDuplicate(id)}>
            ⧉
          </button>
          <button type="button" title="O'chirish" className={`${tool} text-red-300`} onClick={() => editing.onDelete(id)}>
            ✕
          </button>
        </div>
      )}
      {children}
    </div>
  );
}

export function SiteRenderer({
  site,
  page,
  basePath = "",
  shop,
  editing,
}: {
  site: Site;
  page: SitePage;
  /** Sahifalararo havolalar uchun prefiks, masalan /preview/<id> */
  basePath?: string;
  /** Jonli do'kon ma'lumotlari (nashr qilingan sayt va ko'rib chiqishda) */
  shop?: ShopData;
  /** Faqat tahrirlovchida */
  editing?: EditingHandlers;
}) {
  const seen = new Set<string>();
  // Jonli mahsulotlar bo'lsa-yu saytda "Do'kon" bloki bo'lmasa: eski qo'lda yozilgan "Mahsulotlar" bloki
  // o'rniga jonli katalog chiqadi; u ham bo'lmasa — bosh sahifada birinchi blokdan keyin.
  const hasShopBlock = site.pages.some((p) => p.blocks.some((b) => b.type === "shop"));
  const live = !!shop && shop.products.length > 0 && !hasShopBlock;
  const legacyId = live ? site.pages.flatMap((p) => p.blocks).find((b) => b.type === "products")?.id : undefined;
  const autoShop = live && !legacyId && page.slug === "home";
  const contact = site.pages.flatMap((p) => p.blocks).find((b) => b.type === "contact");
  const contactHref = contact ? (page.blocks.includes(contact) ? "#aloqa" : `${basePath}/${site.pages.find((p) => p.blocks.includes(contact))?.slug}#aloqa`) : undefined;

  const header = site.header;
  const showNav = header?.showNav ?? true;
  const ctaText = header?.ctaText ? header.ctaText : contactHref ? "Bog'lanish" : "";
  const ctaHref = header?.ctaText ? (safeHref(header.ctaLink, basePath) ?? contactHref) : contactHref;

  return (
    <div style={themeVars(site)} className="min-h-full">
      <style>{BASE_CSS}</style>
      <header className="sticky top-0 z-10 border-b border-[color:var(--s-line)] bg-[color:var(--s-bg)]/95 backdrop-blur">
        <div className={`${container} flex h-16 items-center justify-between gap-4`}>
          <a href={basePath || "/"} className="flex min-w-0 items-center gap-2.5 text-lg font-extrabold text-[color:var(--s-heading)]">
            {header?.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={header.logo} alt="" className="h-9 w-auto max-w-[120px] object-contain" />
            )}
            <span className="truncate">{site.name}</span>
          </a>
          <nav className="flex items-center gap-1 overflow-x-auto text-sm">
            {showNav &&
              site.pages.length > 1 &&
              site.pages.map((p) => (
                <a
                  key={p.slug}
                  href={p.slug === "home" ? basePath || "/" : `${basePath}/${p.slug}`}
                  className={`rounded-full px-3 py-1.5 whitespace-nowrap ${p.slug === page.slug ? "bg-[color:var(--s-surface)] font-semibold" : "text-[color:var(--s-muted)]"}`}
                >
                  {p.title}
                </a>
              ))}
            {ctaText && ctaHref && (
              <a href={ctaHref} className="ml-1 rounded-full bg-[color:var(--s-accent)] px-4 py-1.5 font-semibold whitespace-nowrap text-white">
                {ctaText}
              </a>
            )}
          </nav>
        </div>
      </header>

      <main>
        {page.blocks.map((block, i) => {
          const first = !seen.has(block.type);
          seen.add(block.type);
          const st = { ...DEFAULT_BLOCK_STYLE, ...(block.style ?? {}) };
          const f = frame(block, st);
          const content =
            block.id === legacyId && block.type === "products" ? (
              <ShopSection shop={shop!} heading={block.heading} subheading={block.subheading} anchor={anchorFor(block, first)} />
            ) : (
              <BlockView block={block} basePath={basePath} anchor={anchorFor(block, first)} shop={shop} st={st} />
            );
          const framed = (
            <div className={f.className} style={f.style}>
              {content}
            </div>
          );
          return (
            <Fragment key={block.id}>
              {editing ? (
                <EditFrame id={block.id} index={i} total={page.blocks.length} editing={editing}>
                  {framed}
                </EditFrame>
              ) : (
                framed
              )}
              {autoShop && i === 0 && <ShopSection shop={shop!} heading="Katalog" subheading="" anchor="katalog" />}
            </Fragment>
          );
        })}
        {autoShop && page.blocks.length === 0 && <ShopSection shop={shop!} heading="Katalog" subheading="" anchor="katalog" />}
      </main>

      <footer className="border-t border-[color:var(--s-line)] py-8 text-center text-sm text-[color:var(--s-muted)]">
        <p className="font-semibold text-[color:var(--s-text)]">{site.name}</p>
        {site.tagline && <p className="mt-1">{site.tagline}</p>}
        <p className="mt-4 text-xs">TezDo&apos;kon yordamida yaratilgan</p>
      </footer>
    </div>
  );
}
