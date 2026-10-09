import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { SiteRenderer } from "@/components/site/renderer";
import { siteSchema } from "@/lib/site/schema";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Nashr qilingan ommaviy sayt.
 * Manzillar: /s/<slug>, <slug>.<asosiy-domen> yoki o'z domeni (middleware shu yerga yo'naltiradi).
 */

type Params = Promise<{ slug: string; page?: string[] }>;

const loadSite = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const { url, anonKey } = getSupabaseEnv();
  // Sessiyasiz klient — ommaviy sahifa cookie'larga bog'liq emas
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data } = await supabase.from("published_sites").select("content").eq("slug", slug).maybeSingle();
  if (!data) return null;
  const parsed = siteSchema.safeParse(data.content);
  return parsed.success ? parsed.data : null;
});

async function basePath(slug: string) {
  // Subdomen yoki o'z domeni orqali kirilganda middleware bo'sh prefiks beradi
  const h = await headers();
  const fromMiddleware = h.get("x-site-base");
  return fromMiddleware !== null ? fromMiddleware : `/s/${slug}`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const site = await loadSite(slug);
  if (!site) return { title: "Sayt topilmadi" };
  return {
    title: { absolute: site.name },
    description: site.tagline || undefined,
    openGraph: { title: site.name, description: site.tagline || undefined },
  };
}

export default async function PublicSitePage({ params }: { params: Params }) {
  const { slug, page } = await params;
  const site = await loadSite(slug);
  if (!site) notFound();

  const pageSlug = page?.[0] ?? "home";
  const current = site.pages.find((p) => p.slug === pageSlug);
  if (!current) notFound();

  return <SiteRenderer site={site} page={current} basePath={await basePath(slug)} />;
}
