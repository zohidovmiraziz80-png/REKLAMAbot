/**
 * Sayt ichidagi havolalarni xavfsiz qiladi: faqat ichki bo'lim (#), sahifa (/slug),
 * tel:, mailto:, https:// va Telegram/Instagram ruxsat etiladi. javascript: va boshqalar bloklanadi.
 */
export function safeHref(raw: string | undefined, basePath = ""): string | undefined {
  const v = (raw ?? "").trim();
  if (!v) return undefined;
  if (v.startsWith("#")) return /^#[\w-]{1,60}$/.test(v) ? v : undefined;
  if (v.startsWith("/") && !v.startsWith("//")) {
    const slug = v.slice(1).replace(/[^a-z0-9-]/gi, "").toLowerCase();
    return slug && slug !== "home" ? `${basePath}/${slug}` : basePath || "/";
  }
  if (/^tel:\+?[\d\s()-]{5,20}$/.test(v)) return v.replace(/\s/g, "");
  if (/^mailto:[^\s@]+@[^\s@]+$/.test(v)) return v;
  if (/^@[\w]{3,32}$/.test(v)) return `https://t.me/${v.slice(1)}`;
  try {
    const url = new URL(v);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function telegramUrl(handle: string) {
  const v = handle.trim();
  if (!v) return undefined;
  if (v.startsWith("https://t.me/")) return safeHref(v);
  const name = v.replace(/^@/, "").replace(/^t\.me\//, "");
  return /^[\w]{3,32}$/.test(name) ? `https://t.me/${name}` : undefined;
}

export function instagramUrl(handle: string) {
  const v = handle.trim();
  if (!v) return undefined;
  if (v.startsWith("https://")) return safeHref(v);
  const name = v.replace(/^@/, "").replace(/^instagram\.com\//, "");
  return /^[\w.]{1,30}$/.test(name) ? `https://instagram.com/${name}` : undefined;
}

export function phoneUrl(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.length >= 7 ? `tel:${digits}` : undefined;
}
