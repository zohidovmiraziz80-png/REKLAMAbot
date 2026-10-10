import { getSiteUrl } from "@/lib/supabase/env";

/** Subdomen sifatida berib bo'lmaydigan nomlar */
export const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "dashboard", "mail", "email", "smtp", "ftp", "cdn", "static", "assets",
  "help", "support", "docs", "blog", "status", "login", "register", "auth", "account", "billing",
  "tezdokon", "mixbot", "platforma", "preview", "s", "test", "dev", "staging",
]);

export const SLUG_RE = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/;

export function normalizeSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/** Platformaning asosiy domeni (masalan mixbot.uz). Bo'lmasa subdomenlar ishlamaydi. */
export function rootDomain() {
  const v = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase();
  return v ? v.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null;
}

export function publicSiteUrls(slug: string) {
  const root = rootDomain();
  return {
    pathUrl: `${getSiteUrl()}/s/${slug}`,
    subdomainUrl: root ? `https://${slug}.${root}` : null,
  };
}

/** Foydalanuvchi kiritgan domenni tozalaydi: https://, yo'l va oxirgi nuqtani olib tashlaydi */
export function normalizeDomain(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/** Platformaning o'z domenlarini foydalanuvchi ulay olmasin */
export function isPlatformDomain(domain: string) {
  const root = rootDomain();
  if (domain.endsWith(".vercel.app") || domain === "vercel.app") return true;
  if (root && (domain === root || domain.endsWith(`.${root}`))) return true;
  try {
    if (domain === new URL(getSiteUrl()).host) return true;
  } catch {
    // e'tiborsiz
  }
  return false;
}
