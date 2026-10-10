import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getSiteUrl, getSupabaseEnv } from "@/lib/supabase/env";

/**
 * 1. Mijoz saytlari: <slug>.<NEXT_PUBLIC_ROOT_DOMAIN> yoki o'z domeni → /s/<slug>/... ga ichki yo'naltirish.
 * 2. Platformaning o'zi: sessiyani yangilash va himoyalangan sahifalarni tekshirish.
 */

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || null;
const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin"]);

function platformHosts() {
  const hosts = new Set<string>(["localhost:3000", "localhost"]);
  try {
    hosts.add(new URL(getSiteUrl()).host);
  } catch {
    // e'tiborsiz
  }
  if (ROOT) {
    hosts.add(ROOT);
    hosts.add(`www.${ROOT}`);
    hosts.add(`app.${ROOT}`);
  }
  return hosts;
}

function rewriteToSite(request: NextRequest, slug: string) {
  const url = request.nextUrl.clone();
  const path = url.pathname === "/" ? "" : url.pathname;
  url.pathname = `/s/${slug}${path}`;
  const headers = new Headers(request.headers);
  headers.set("x-site-base", "");
  return NextResponse.rewrite(url, { request: { headers } });
}

// Domen → slug natijasini qisqa muddat eslab qolamiz (har so'rovda bazaga bormaslik uchun)
const domainCache = new Map<string, { slug: string | null; at: number }>();
const CACHE_MS = 60_000;

async function resolveDomain(host: string): Promise<string | null> {
  const hit = domainCache.get(host);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.slug;
  let slug: string | null = null;
  try {
    const { url, anonKey } = getSupabaseEnv();
    const res = await fetch(`${url}/rest/v1/rpc/resolve_site_domain`, {
      method: "POST",
      headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, "content-type": "application/json" },
      body: JSON.stringify({ d: host }),
    });
    if (res.ok) slug = (await res.json()) as string | null;
  } catch {
    slug = null;
  }
  domainCache.set(host, { slug, at: Date.now() });
  return slug;
}

export async function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const path = request.nextUrl.pathname;

  const isPlatform = platformHosts().has(host) || host.endsWith(".vercel.app");

  // Ommaviy do'kon API'si (buyurtma) har qanday domendan, sessiyasiz ishlaydi
  if (path.startsWith("/api/shop/")) return NextResponse.next();

  if (!isPlatform) {
    // <slug>.<asosiy-domen>
    if (ROOT && host.endsWith(`.${ROOT}`)) {
      const sub = host.slice(0, -(ROOT.length + 1));
      if (sub && !sub.includes(".") && !RESERVED_SUBDOMAINS.has(sub)) return rewriteToSite(request, sub);
    }
    // Foydalanuvchining o'z domeni
    const bareHost = host.replace(/:\d+$/, "");
    const slug = await resolveDomain(bareHost);
    if (slug) return rewriteToSite(request, slug);
    return new NextResponse("Bu domenga sayt ulanmagan", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  // Telegram webhook sessiya talab qilmaydi (maxfiy kalit bilan tekshiriladi)
  if (path.startsWith("/api/telegram/")) return NextResponse.next();

  // Ommaviy saytlar sessiya talab qilmaydi; tashqaridan kelgan x-site-base sarlavhasini olib tashlaymiz
  if (path.startsWith("/s/")) {
    const headers = new Headers(request.headers);
    headers.delete("x-site-base");
    return NextResponse.next({ request: { headers } });
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
