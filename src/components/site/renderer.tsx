import { Fragment, type CSSProperties } from "react";
import type { Block, Site, SitePage } from "@/lib/site/schema";
import { instagramUrl, phoneUrl, safeHref, telegramUrl } from "@/lib/site/safe";
import type { ShopData } from "@/lib/shop/types";
import { ShopPlaceholder, ShopSection } from "./shop";

/**
 * Sayt tuzilmasini (JSON) xavfsiz React komponentlarga aylantiradi.
 * HTML hech qachon to'g'ridan-to'g'ri qo'yilmaydi — faqat matn sifatida chiqadi.
 * Server va brauzerda ishlaydi (hook'lar yo'q; do'kon bloki alohida client komponent).
 */

const FONTS: Record<Site["theme"]["font"], string> = {
  modern: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  classic: 'Georgia, "Times New Roman", ui-serif, serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, sans-serif',
};

const RADIUS: Record<Site["theme"]["radius"], string> = { sharp: "4px", soft: "14px", round: "28px" };

function themeVars(site: Site): CSSProperties {
  const dark = site.theme.mode === "dark";
  return {
    ["--s-primary" as string]: site.theme.primary,
    ["--s-accent" as string]: site.theme.accent,
    ["--s-bg" as string]: dark ? "#0b1020" : "#ffffff",
    ["--s-surface" as string]: dark ? "#141a2e" : "#f5f7fb",
    ["--s-text" as string]: dark ? "#eef1f8" : "#111827",
    ["--s-muted" as string]: dark ? "#a5adc2" : "#5b6475",
    ["--s-line" as string]: dark ? "#263050" : "#e5e8f0",
    ["--s-heading" as string]: dark ? "#ffffff" : site.theme.primary,
    ["--s-radius" as string]: RADIUS[site.theme.radius],
    fontFamily: FONTS[site.theme.font],
    background: "var(--s-bg)",
    color: "var(--s-text)",
  } as CSSProperties;
}

const container = "mx-auto w-full max-w-5xl px-5";
const sectionPad = "py-14 sm:py-20";
const h2 = "text-2xl sm:text-3xl font-bold tracking-tight text-[color:var(--s-heading)]";
const card = "rounded-[var(--s-radius)] border border-[color:var(--s-line)] bg-[color:var(--s-surface)] p-5";

function Button({ href, children, variant = "accent" }: { href?: string; children: React.ReactNode; variant?: "accent" | "light" }) {
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
  return block.id;
}

function BlockView({ block, basePath, anchor, shop }: { block: Block; basePath: string; anchor: string; shop?: ShopData }) {
  switch (block.type) {
    case "shop":
      return shop && (shop.products.length > 0 || !shop.embedded) ? (
        <ShopSection shop={shop} heading={block.heading} subheading={block.subheading} anchor={anchor} />
      ) : (
        <ShopPlaceholder heading={block.heading} subheading={block.subheading} anchor={anchor} />
      );

    case "hero":
      return (
        <section id={anchor} className="bg-[color:var(--s-primary)] text-white">
          <div className={`${container} py-20 sm:py-28 ${block.align === "center" ? "text-center" : ""}`}>
            <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-5xl">{block.heading}</h1>
            {block.subheading && (
              <p className={`mt-5 text-lg text-white/85 text-pretty ${block.align === "center" ? "mx-auto max-w-2xl" : "max-w-2xl"}`}>
                {block.subheading}
              </p>
            )}
            {block.ctaText && (
              <div className="mt-8">
                <Button href={safeHref(block.ctaLink, basePath)}>{block.ctaText}</Button>
              </div>
            )}
          </div>
        </section>
      );

    case "features":
      return (
        <section id={anchor} className={sectionPad}>
          <div className={container}>
            {block.heading && <h2 className={`${h2} text-center`}>{block.heading}</h2>}
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
            {block.heading && <h2 className={`${h2} text-center`}>{block.heading}</h2>}
            {block.subheading && <p className="mx-auto mt-3 max-w-2xl text-center text-[color:var(--s-muted)]">{block.subheading}</p>}
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {block.items.map((it, i) => (
                <div key={i} className="relative flex flex-col rounded-[var(--s-radius)] border border-[color:var(--s-line)] bg-[color:var(--s-bg)] p-5">
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

    case "about":
      return (
        <section id={anchor} className={sectionPad}>
          <div className={`${container} max-w-3xl`}>
            {block.heading && <h2 className={h2}>{block.heading}</h2>}
            <p className="mt-5 text-lg leading-relaxed whitespace-pre-line text-[color:var(--s-muted)]">{block.text}</p>
          </div>
        </section>
      );

    case "testimonials":
      return (
        <section id={anchor} className={`${sectionPad} bg-[color:var(--s-surface)]`}>
          <div className={container}>
            {block.heading && <h2 className={`${h2} text-center`}>{block.heading}</h2>}
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {block.items.map((it, i) => (
                <figure key={i} className="rounded-[var(--s-radius)] border border-[color:var(--s-line)] bg-[color:var(--s-bg)] p-5">
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
            {block.heading && <h2 className={`${h2} text-center`}>{block.heading}</h2>}
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
            <div className="rounded-[var(--s-radius)] bg-[color:var(--s-primary)] px-6 py-12 text-center text-white sm:px-12">
              <h2 className="text-2xl font-bold sm:text-3xl">{block.heading}</h2>
              {block.text && <p className="mx-auto mt-3 max-w-xl text-white/85">{block.text}</p>}
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
          <div className={`${container} max-w-3xl text-center`}>
            {block.heading && <h2 className={h2}>{block.heading}</h2>}
            {block.text && <p className="mx-auto mt-3 max-w-xl text-[color:var(--s-muted)]">{block.text}</p>}
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

export function SiteRenderer({
  site,
  page,
  basePath = "",
  shop,
}: {
  site: Site;
  page: SitePage;
  /** Sahifalararo havolalar uchun prefiks, masalan /preview/<id> */
  basePath?: string;
  /** Jonli do'kon ma'lumotlari (nashr qilingan sayt va ko'rib chiqishda) */
  shop?: ShopData;
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

  return (
    <div style={themeVars(site)} className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-[color:var(--s-line)] bg-[color:var(--s-bg)]/95 backdrop-blur">
        <div className={`${container} flex h-16 items-center justify-between gap-4`}>
          <a href={basePath || "/"} className="truncate text-lg font-extrabold text-[color:var(--s-heading)]">
            {site.name}
          </a>
          <nav className="flex items-center gap-1 overflow-x-auto text-sm">
            {site.pages.length > 1 &&
              site.pages.map((p) => (
                <a
                  key={p.slug}
                  href={p.slug === "home" ? basePath || "/" : `${basePath}/${p.slug}`}
                  className={`rounded-full px-3 py-1.5 whitespace-nowrap ${p.slug === page.slug ? "bg-[color:var(--s-surface)] font-semibold" : "text-[color:var(--s-muted)]"}`}
                >
                  {p.title}
                </a>
              ))}
            {contactHref && (
              <a href={contactHref} className="ml-1 rounded-full bg-[color:var(--s-accent)] px-4 py-1.5 font-semibold whitespace-nowrap text-white">
                Bog&apos;lanish
              </a>
            )}
          </nav>
        </div>
      </header>

      <main>
        {page.blocks.map((block, i) => {
          const first = !seen.has(block.type);
          seen.add(block.type);
          return (
            <Fragment key={block.id}>
              {block.id === legacyId && block.type === "products" ? (
                <ShopSection shop={shop!} heading={block.heading} subheading={block.subheading} anchor={anchorFor(block, first)} />
              ) : (
                <BlockView block={block} basePath={basePath} anchor={anchorFor(block, first)} shop={shop} />
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
        <p className="mt-4 text-xs">
          TezDo&apos;kon yordamida yaratilgan
        </p>
      </footer>
    </div>
  );
}
