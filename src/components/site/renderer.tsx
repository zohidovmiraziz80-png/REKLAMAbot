import { Fragment, type CSSProperties, type ReactNode } from "react";
import { DEFAULT_BLOCK_STYLE, type Block, type BlockStyle, type Site, type SitePage } from "@/lib/site/schema";
import { instagramUrl, phoneUrl, safeHref, telegramUrl } from "@/lib/site/safe";
import type { ShopData } from "@/lib/shop/types";
import { BlockScope, E, EditProvider } from "./editable";
import { ShopPlaceholder, ShopSection, type ShopLayout } from "./shop";

/**
 * Sayt tuzilmasini (JSON) xavfsiz React komponentlarga aylantiradi.
 * HTML hech qachon to'g'ridan-to'g'ri qo'yilmaydi — faqat matn sifatida chiqadi.
 * Har bir blok turi bir nechta tayyor dizaynga ega (variant).
 * Tahrirlovchida `editing` beriladi — bloklarni tanlash, ko'chirish va matnni joyida tahrirlash mumkin.
 */

const FONTS: Record<Site["theme"]["font"], string> = {
  modern: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  classic: 'Georgia, "Times New Roman", ui-serif, serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, sans-serif',
};

const RADIUS: Record<Site["theme"]["radius"], string> = { sharp: "4px", soft: "14px", round: "28px" };

export function themeVars(site: Site): CSSProperties {
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

function Button({ href, children, variant = "accent" }: { href?: string; children: ReactNode; variant?: "accent" | "light" | "outline" }) {
  if (!children) return null;
  const cls =
    variant === "accent"
      ? "bg-[color:var(--s-accent)] text-white hover:brightness-110"
      : variant === "outline"
        ? "border-2 border-current hover:bg-white/10"
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

function ContactRows({ block, layout }: { block: Extract<Block, { type: "contact" }>; layout: "grid" | "stack" | "inline" }) {
  const rows = [
    block.phone && { icon: "📞", label: "Telefon", value: block.phone, href: phoneUrl(block.phone) },
    block.telegram && { icon: "✈️", label: "Telegram", value: block.telegram, href: telegramUrl(block.telegram) },
    block.instagram && { icon: "📸", label: "Instagram", value: block.instagram, href: instagramUrl(block.instagram) },
    block.address && { icon: "📍", label: "Manzil", value: block.address },
    block.workingHours && { icon: "🕘", label: "Ish vaqti", value: block.workingHours },
  ].filter(Boolean) as { icon: string; label: string; value: string; href?: string }[];
  if (!rows.length) return null;
  if (layout === "inline") {
    return (
      <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2">
        {rows.map((r) =>
          r.href ? (
            <a key={r.label} href={r.href} className="font-semibold hover:text-[color:var(--s-accent)]" {...(r.href.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              {r.icon} {r.value}
            </a>
          ) : (
            <span key={r.label}>
              {r.icon} {r.value}
            </span>
          ),
        )}
      </div>
    );
  }
  return (
    <div className={`mt-8 grid gap-3 text-left ${layout === "grid" ? "sm:grid-cols-2" : ""}`}>
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
  );
}

function BlockView({ block, basePath, anchor, shop, st }: { block: Block; basePath: string; anchor: string; shop?: ShopData; st: BlockStyle }) {
  const center = st.align !== "left";
  const hc = center ? "text-center" : "";
  const sub = center ? "mx-auto text-center" : "";
  const v = block.variant ?? "";

  switch (block.type) {
    case "shop":
      return shop && (shop.products.length > 0 || !shop.embedded) ? (
        <ShopSection
          shop={shop}
          heading={block.heading}
          subheading={block.subheading}
          headingNode={block.heading ? <E path="heading" value={block.heading} /> : undefined}
          subheadingNode={block.subheading ? <E path="subheading" value={block.subheading} /> : undefined}
          anchor={anchor}
          layout={shopLayout(block)}
        />
      ) : (
        <ShopPlaceholder heading={block.heading} subheading={block.subheading} anchor={anchor} />
      );

    case "hero": {
      const cta = block.ctaText ? (
        <Button href={safeHref(block.ctaLink, basePath)}>
          <E path="ctaText" value={block.ctaText} />
        </Button>
      ) : null;
      const title = <E as="h1" path="heading" value={block.heading} className="block text-3xl font-extrabold tracking-tight text-balance sm:text-5xl" />;
      const subtitle = block.subheading ? <E as="p" path="subheading" value={block.subheading} multiline className="mt-5 block max-w-2xl text-lg text-pretty opacity-85" /> : null;

      if (v === "split") {
        return (
          <section id={anchor} className="bg-[color:var(--s-surface)]">
            <div className={`${container} grid items-center gap-10 py-16 sm:py-24 md:grid-cols-2`}>
              <div className="text-[color:var(--s-text)]">
                <div className="text-[color:var(--s-heading)]">{title}</div>
                {subtitle}
                {cta && <div className="mt-8">{cta}</div>}
              </div>
              {block.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={block.image} alt="" className="aspect-[4/3] w-full rounded-[var(--s-radius)] object-cover shadow-xl" />
              ) : (
                <div className="grid aspect-[4/3] place-items-center rounded-[var(--s-radius)] bg-[color:var(--s-primary)] text-6xl text-white/80">🖼</div>
              )}
            </div>
          </section>
        );
      }
      if (v === "image") {
        return (
          <section
            id={anchor}
            className="bg-[color:var(--s-primary)] text-white"
            style={block.image ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.55),rgba(0,0,0,0.25)),url("${block.image}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          >
            <div className={`${container} flex min-h-[70vh] flex-col justify-end py-16 sm:py-24`}>
              {title}
              {subtitle}
              {cta && <div className="mt-8">{cta}</div>}
            </div>
          </section>
        );
      }
      if (v === "minimal") {
        return (
          <section id={anchor}>
            <div className={`${container} py-20 sm:py-28 ${block.align === "center" ? "text-center [&_p]:mx-auto" : ""}`}>
              <div className="text-[color:var(--s-heading)]">{title}</div>
              <div className="text-[color:var(--s-muted)]">{subtitle}</div>
              {cta && <div className="mt-8">{cta}</div>}
              <div className={`mt-12 h-1 w-24 rounded-full bg-[color:var(--s-accent)] ${block.align === "center" ? "mx-auto" : ""}`} />
            </div>
          </section>
        );
      }
      // classic: rangli fon (rasm bo'lsa — fon yoki yonida)
      const side = !!block.image && block.imageMode === "side";
      const bgImage = !!block.image && !side;
      const heroCenter = block.align === "center" && !side;
      return (
        <section
          id={anchor}
          className="bg-[color:var(--s-primary)] text-white"
          style={bgImage ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.35)),url("${block.image}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          <div className={`${container} py-20 sm:py-28 ${side ? "grid items-center gap-10 md:grid-cols-2" : ""} ${heroCenter ? "text-center [&_p]:mx-auto" : ""}`}>
            <div>
              {title}
              {subtitle}
              {cta && <div className="mt-8">{cta}</div>}
            </div>
            {side && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={block.image} alt="" className="aspect-[4/3] w-full rounded-[var(--s-radius)] object-cover shadow-2xl" />
            )}
          </div>
        </section>
      );
    }

    case "features": {
      const heading = block.heading ? <E as="h2" path="heading" value={block.heading} className={`block ${h2} ${hc}`} /> : null;
      if (v === "icons") {
        return (
          <section id={anchor} className={sectionPad}>
            <div className={container}>
              {heading}
              <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {block.items.map((it, i) => (
                  <div key={i} className="text-center">
                    {it.icon && <div className="mx-auto grid size-16 place-items-center rounded-full bg-[color:var(--s-surface)] text-3xl">{it.icon}</div>}
                    <E as="h3" path={`items.${i}.title`} value={it.title} className="mt-4 block text-lg font-semibold" />
                    <E as="p" path={`items.${i}.text`} value={it.text} multiline className="mt-1.5 block text-[color:var(--s-muted)]" />
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      }
      if (v === "list") {
        return (
          <section id={anchor} className={sectionPad}>
            <div className={`${container} max-w-4xl`}>
              {heading}
              <div className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-2">
                {block.items.map((it, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-[calc(var(--s-radius)*0.6)] bg-[color:var(--s-accent)] text-lg text-white">{it.icon || "✓"}</span>
                    <div>
                      <E as="h3" path={`items.${i}.title`} value={it.title} className="block font-semibold" />
                      <E as="p" path={`items.${i}.text`} value={it.text} multiline className="mt-1 block text-[color:var(--s-muted)]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      }
      return (
        <section id={anchor} className={sectionPad}>
          <div className={container}>
            {heading}
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {block.items.map((it, i) => (
                <div key={i} className={card}>
                  {it.icon && <div className="text-3xl">{it.icon}</div>}
                  <E as="h3" path={`items.${i}.title`} value={it.title} className="mt-3 block text-lg font-semibold" />
                  <E as="p" path={`items.${i}.text`} value={it.text} multiline className="mt-1.5 block text-[color:var(--s-muted)]" />
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "products":
      return (
        <section id={anchor} className={`${sectionPad} bg-[color:var(--s-surface)]`}>
          <div className={container}>
            {block.heading && <E as="h2" path="heading" value={block.heading} className={`block ${h2} ${hc}`} />}
            {block.subheading && <E as="p" path="subheading" value={block.subheading} className={`mt-3 block max-w-2xl text-[color:var(--s-muted)] ${sub}`} />}
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {block.items.map((it, i) => (
                <div key={i} className="s-card relative flex flex-col rounded-[var(--s-radius)] border border-[color:var(--s-line)] bg-[color:var(--s-bg)] p-5">
                  {it.badge && (
                    <span className="absolute top-4 right-4 rounded-full bg-[color:var(--s-accent)] px-2.5 py-0.5 text-xs font-semibold text-white">{it.badge}</span>
                  )}
                  <div className="grid h-28 place-items-center rounded-[calc(var(--s-radius)*0.7)] bg-[color:var(--s-surface)] text-5xl">{it.emoji || "📦"}</div>
                  <E as="h3" path={`items.${i}.name`} value={it.name} className="mt-4 block text-lg font-semibold" />
                  {it.description && <E as="p" path={`items.${i}.description`} value={it.description} multiline className="mt-1 block flex-1 text-sm text-[color:var(--s-muted)]" />}
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
            {block.caption && (
              <E as="figcaption" path="caption" value={block.caption} className={`mt-3 block text-sm text-[color:var(--s-muted)] ${hc} ${block.width === "full" ? "px-5" : ""}`} />
            )}
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
            {block.heading && <E as="h2" path="heading" value={block.heading} className={`block ${h2} ${hc}`} />}
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
            {block.heading && <E as="h2" path="heading" value={block.heading} className={`block ${h2}`} />}
            <E as="p" path="text" value={block.text} multiline className="mt-4 block text-lg leading-relaxed whitespace-pre-line text-[color:var(--s-muted)]" />
          </div>
        </section>
      );

    case "about": {
      const heading = block.heading ? <E as="h2" path="heading" value={block.heading} className={`block ${h2}`} /> : null;
      const text = <E as="p" path="text" value={block.text} multiline className="mt-5 block text-lg leading-relaxed whitespace-pre-line text-[color:var(--s-muted)]" />;
      const img = block.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.image} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-[var(--s-radius)] object-cover" />
      ) : (
        <div className="grid aspect-[4/3] w-full place-items-center rounded-[var(--s-radius)] bg-[color:var(--s-surface)] text-6xl">🏪</div>
      );
      if (v === "split") {
        return (
          <section id={anchor} className={sectionPad}>
            <div className={`${container} grid items-center gap-10 md:grid-cols-2`}>
              <div>
                {heading}
                {text}
              </div>
              {img}
            </div>
          </section>
        );
      }
      if (v === "card") {
        return (
          <section id={anchor} className={`${sectionPad} bg-[color:var(--s-surface)]`}>
            <div className={`${container} max-w-3xl`}>
              <div className="s-card rounded-[var(--s-radius)] bg-[color:var(--s-bg)] p-8 shadow-lg sm:p-12">
                <div className={hc}>
                  {heading}
                  {text}
                </div>
              </div>
            </div>
          </section>
        );
      }
      return (
        <section id={anchor} className={sectionPad}>
          <div className={`${container} ${block.image ? "grid items-center gap-10 md:grid-cols-2" : `max-w-3xl ${hc}`}`}>
            {block.image && img}
            <div>
              {heading}
              {text}
            </div>
          </div>
        </section>
      );
    }

    case "testimonials": {
      const heading = block.heading ? <E as="h2" path="heading" value={block.heading} className={`block ${h2} ${hc}`} /> : null;
      if (v === "quote") {
        return (
          <section id={anchor} className={sectionPad}>
            <div className={`${container} max-w-3xl`}>
              {heading}
              <div className="mt-10 space-y-10">
                {block.items.map((it, i) => (
                  <figure key={i} className="text-center">
                    <div className="text-5xl leading-none text-[color:var(--s-accent)]">“</div>
                    <E as="blockquote" path={`items.${i}.text`} value={it.text} multiline className="mt-2 block text-xl leading-relaxed font-medium sm:text-2xl" />
                    <figcaption className="mt-4 text-sm font-semibold">
                      <E path={`items.${i}.name`} value={it.name} />
                      {it.role && <span className="font-normal text-[color:var(--s-muted)]"> · {it.role}</span>}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        );
      }
      return (
        <section id={anchor} className={`${sectionPad} bg-[color:var(--s-surface)]`}>
          <div className={container}>
            {heading}
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {block.items.map((it, i) => (
                <figure key={i} className="s-card rounded-[var(--s-radius)] border border-[color:var(--s-line)] bg-[color:var(--s-bg)] p-5">
                  <E as="blockquote" path={`items.${i}.text`} value={it.text} multiline className="block text-[color:var(--s-text)]" />
                  <figcaption className="mt-4 text-sm font-semibold">
                    <E path={`items.${i}.name`} value={it.name} />
                    {it.role && <span className="font-normal text-[color:var(--s-muted)]"> · {it.role}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "faq": {
      const heading = block.heading ? <E as="h2" path="heading" value={block.heading} className={`block ${h2} ${hc}`} /> : null;
      if (v === "columns") {
        return (
          <section id={anchor} className={sectionPad}>
            <div className={container}>
              {heading}
              <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
                {block.items.map((it, i) => (
                  <div key={i}>
                    <E as="h3" path={`items.${i}.q`} value={it.q} className="block font-semibold" />
                    <E as="p" path={`items.${i}.a`} value={it.a} multiline className="mt-2 block whitespace-pre-line text-[color:var(--s-muted)]" />
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      }
      return (
        <section id={anchor} className={sectionPad}>
          <div className={`${container} max-w-3xl`}>
            {heading}
            <div className="mt-8 space-y-3">
              {block.items.map((it, i) => (
                <details key={i} className={`${card} group`}>
                  <summary className="cursor-pointer list-none font-semibold marker:hidden">
                    <span className="flex items-center justify-between gap-4">
                      <E path={`items.${i}.q`} value={it.q} />
                      <span className="text-[color:var(--s-accent)] transition group-open:rotate-45">＋</span>
                    </span>
                  </summary>
                  <E as="p" path={`items.${i}.a`} value={it.a} multiline className="mt-3 block whitespace-pre-line text-[color:var(--s-muted)]" />
                </details>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "cta": {
      const btn = (variant: "accent" | "light") => (
        <Button href={safeHref(block.buttonLink, basePath)} variant={variant}>
          <E path="buttonText" value={block.buttonText} />
        </Button>
      );
      if (v === "bar") {
        return (
          <section id={anchor} className="bg-[color:var(--s-accent)] py-10 text-white">
            <div className={`${container} flex flex-col items-center justify-between gap-5 sm:flex-row`}>
              <div className="text-center sm:text-left">
                <E as="h2" path="heading" value={block.heading} className="block text-2xl font-bold" />
                {block.text && <E as="p" path="text" value={block.text} className="mt-1 block text-white/85" />}
              </div>
              <div className="shrink-0">{btn("light")}</div>
            </div>
          </section>
        );
      }
      if (v === "minimal") {
        return (
          <section id={anchor} className="py-16">
            <div className={`${container} max-w-2xl ${hc}`}>
              <E as="h2" path="heading" value={block.heading} className={`block ${h2}`} />
              {block.text && <E as="p" path="text" value={block.text} className="mt-3 block text-[color:var(--s-muted)]" />}
              <div className="mt-7">{btn("accent")}</div>
            </div>
          </section>
        );
      }
      return (
        <section id={anchor} className="py-14">
          <div className={container}>
            <div className={`rounded-[var(--s-radius)] bg-[color:var(--s-primary)] px-6 py-12 text-white sm:px-12 ${center ? "text-center [&_p]:mx-auto" : ""}`}>
              <E as="h2" path="heading" value={block.heading} className="block text-2xl font-bold sm:text-3xl" />
              {block.text && <E as="p" path="text" value={block.text} multiline className="mt-3 block max-w-xl text-white/85" />}
              <div className="mt-7">{btn("accent")}</div>
            </div>
          </div>
        </section>
      );
    }

    case "contact": {
      const heading = block.heading ? <E as="h2" path="heading" value={block.heading} className={`block ${h2}`} /> : null;
      const text = block.text ? <E as="p" path="text" value={block.text} multiline className="mt-3 block max-w-xl text-[color:var(--s-muted)]" /> : null;
      if (v === "split") {
        return (
          <section id={anchor} className={sectionPad}>
            <div className={`${container} grid gap-10 md:grid-cols-2`}>
              <div>
                {heading}
                {text}
                {block.phone && (
                  <a href={phoneUrl(block.phone)} className="mt-6 inline-block text-3xl font-extrabold text-[color:var(--s-accent)]">
                    {block.phone}
                  </a>
                )}
              </div>
              <ContactRows block={block} layout="stack" />
            </div>
          </section>
        );
      }
      if (v === "minimal") {
        return (
          <section id={anchor} className="border-t border-[color:var(--s-line)] py-12">
            <div className={`${container} text-center [&_p]:mx-auto`}>
              {heading}
              {text}
              <ContactRows block={block} layout="inline" />
            </div>
          </section>
        );
      }
      return (
        <section id={anchor} className={`${sectionPad} bg-[color:var(--s-surface)]`}>
          <div className={`${container} max-w-3xl ${hc} ${center ? "[&_p]:mx-auto" : ""}`}>
            {heading}
            {text}
            <ContactRows block={block} layout="grid" />
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
  onField: (blockId: string, path: string, value: string) => void;
  onAddAfter: (id: string) => void;
};

function EditFrame({ id, index, total, editing, children }: { id: string; index: number; total: number; editing: EditingHandlers; children: ReactNode }) {
  const selected = editing.selectedId === id;
  const tool = "grid size-7 place-items-center rounded-md text-sm hover:bg-white/20 disabled:opacity-30";
  return (
    <div
      data-block-id={id}
      onClick={() => editing.onSelect(id)}
      className={`group/blk relative outline-offset-[-2px] ${selected ? "outline-2 outline-[#f7821b] outline-solid" : "hover:outline-2 hover:outline-[#2457b8]/60 hover:outline-dashed"}`}
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
      <BlockScope id={id}>{children}</BlockScope>
      <button
        type="button"
        title="Shu yerga blok qo'shish"
        onClick={(e) => {
          e.stopPropagation();
          editing.onAddAfter(id);
        }}
        className="absolute -bottom-3.5 left-1/2 z-20 hidden -translate-x-1/2 rounded-full bg-[#f7821b] px-3 py-1 text-xs font-semibold text-white shadow-lg group-hover/blk:block"
        style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
      >
        + Blok
      </button>
    </div>
  );
}

function SiteHeader({ site, page, basePath, contactHref }: { site: Site; page: SitePage; basePath: string; contactHref?: string }) {
  const header = site.header;
  const showNav = header?.showNav ?? true;
  const ctaText = header?.ctaText ? header.ctaText : contactHref ? "Bog'lanish" : "";
  const ctaHref = header?.ctaText ? (safeHref(header.ctaLink, basePath) ?? contactHref) : contactHref;
  const variant = header?.variant ?? "classic";
  const dark = variant === "dark";
  const logo = (
    <a href={basePath || "/"} className={`flex min-w-0 items-center gap-2.5 text-lg font-extrabold ${dark ? "text-white" : "text-[color:var(--s-heading)]"}`}>
      {header?.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={header.logo} alt="" className="h-9 w-auto max-w-[120px] object-contain" />
      )}
      <span className="truncate">{site.name}</span>
    </a>
  );
  const links =
    showNav && site.pages.length > 1
      ? site.pages.map((p) => (
          <a
            key={p.slug}
            href={p.slug === "home" ? basePath || "/" : `${basePath}/${p.slug}`}
            className={`rounded-full px-3 py-1.5 whitespace-nowrap ${
              p.slug === page.slug ? (dark ? "bg-white/15 font-semibold" : "bg-[color:var(--s-surface)] font-semibold") : dark ? "text-white/75" : "text-[color:var(--s-muted)]"
            }`}
          >
            {p.title}
          </a>
        ))
      : null;
  const cta =
    ctaText && ctaHref ? (
      <a href={ctaHref} className="ml-1 rounded-full bg-[color:var(--s-accent)] px-4 py-1.5 font-semibold whitespace-nowrap text-white">
        {ctaText}
      </a>
    ) : null;

  if (variant === "centered") {
    return (
      <header className="sticky top-0 z-10 border-b border-[color:var(--s-line)] bg-[color:var(--s-bg)]/95 backdrop-blur">
        <div className={`${container} flex flex-col items-center gap-2 py-3`}>
          {logo}
          <nav className="flex max-w-full items-center gap-1 overflow-x-auto text-sm">
            {links}
            {cta}
          </nav>
        </div>
      </header>
    );
  }
  return (
    <header
      className={`sticky top-0 z-10 border-b backdrop-blur ${dark ? "border-transparent bg-[color:var(--s-primary)] text-white" : "border-[color:var(--s-line)] bg-[color:var(--s-bg)]/95"}`}
    >
      <div className={`${container} flex h-16 items-center justify-between gap-4`}>
        {logo}
        <nav className="flex items-center gap-1 overflow-x-auto text-sm">
          {links}
          {cta}
        </nav>
      </div>
    </header>
  );
}

function SiteFooter({ site, basePath }: { site: Site; basePath: string }) {
  const f = site.footer;
  const variant = f?.variant ?? "simple";
  const contact = site.pages.flatMap((p) => p.blocks).find((b) => b.type === "contact");
  const brand = <p className="text-xs opacity-70">TezDo&apos;kon yordamida yaratilgan</p>;
  if (variant === "columns" || variant === "dark") {
    const dark = variant === "dark";
    return (
      <footer className={dark ? "bg-[#0b1020] text-white/80" : "border-t border-[color:var(--s-line)] bg-[color:var(--s-surface)] text-[color:var(--s-muted)]"}>
        <div className={`${container} grid gap-8 py-12 text-sm sm:grid-cols-3`}>
          <div>
            <p className={`text-lg font-extrabold ${dark ? "text-white" : "text-[color:var(--s-heading)]"}`}>{site.name}</p>
            {(f?.text || site.tagline) && <p className="mt-2">{f?.text || site.tagline}</p>}
          </div>
          <div>
            <p className={`mb-2 font-semibold ${dark ? "text-white" : "text-[color:var(--s-text)]"}`}>Sahifalar</p>
            <ul className="space-y-1">
              {site.pages.map((p) => (
                <li key={p.slug}>
                  <a href={p.slug === "home" ? basePath || "/" : `${basePath}/${p.slug}`} className="hover:underline">
                    {p.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          {contact && contact.type === "contact" && (
            <div>
              <p className={`mb-2 font-semibold ${dark ? "text-white" : "text-[color:var(--s-text)]"}`}>Aloqa</p>
              <ul className="space-y-1">
                {contact.phone && <li>📞 {contact.phone}</li>}
                {contact.telegram && <li>✈️ {contact.telegram}</li>}
                {contact.instagram && <li>📸 {contact.instagram}</li>}
                {contact.address && <li>📍 {contact.address}</li>}
              </ul>
            </div>
          )}
        </div>
        <div className={`border-t py-4 text-center ${dark ? "border-white/10" : "border-[color:var(--s-line)]"}`}>{brand}</div>
      </footer>
    );
  }
  return (
    <footer className="border-t border-[color:var(--s-line)] py-8 text-center text-sm text-[color:var(--s-muted)]">
      <p className="font-semibold text-[color:var(--s-text)]">{site.name}</p>
      {(f?.text || site.tagline) && <p className="mt-1">{f?.text || site.tagline}</p>}
      <div className="mt-4">{brand}</div>
    </footer>
  );
}

/** Bloklar kutubxonasida bitta blokning namunaviy ko'rinishi */
export function BlockPreview({ site, block, shop }: { site: Site; block: Block; shop?: ShopData }) {
  const st = { ...DEFAULT_BLOCK_STYLE, ...(block.style ?? {}) };
  const f = frame(block, st);
  return (
    <div style={themeVars(site)}>
      <style>{BASE_CSS}</style>
      <div className={f.className} style={f.style}>
        <BlockView block={block} basePath="" anchor={block.id} shop={shop} st={st} />
      </div>
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

  const body = (
    <div style={themeVars(site)} className="min-h-full">
      <style>{BASE_CSS}</style>
      <SiteHeader site={site} page={page} basePath={basePath} contactHref={contactHref} />

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

      <SiteFooter site={site} basePath={basePath} />
    </div>
  );

  return editing ? <EditProvider onField={editing.onField}>{body}</EditProvider> : body;
}
