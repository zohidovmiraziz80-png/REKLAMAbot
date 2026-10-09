import { z } from "zod";
import { siteSchema } from "@/lib/site/schema";
import {
  DOMAIN_RE,
  RESERVED_SLUGS,
  SLUG_RE,
  isPlatformDomain,
  normalizeDomain,
  normalizeSlug,
  publicSiteUrls,
} from "@/lib/site/hosting";
import {
  DomainApiError,
  addProjectDomain,
  checkProjectDomain,
  isDomainApiConfigured,
  removeProjectDomain,
  type DnsRecord,
} from "@/lib/vercel/domains";
import { ActionError, defineAction, type ActionContext } from "./define";
import { logAudit } from "./audit";

const MAX_DOMAINS_PER_SITE = 3;

export type SiteDomainInfo = {
  domain: string;
  status: "pending" | "active" | "error";
  lastError: string | null;
  records: DnsRecord[];
};

export type PublishStatus = {
  slug: string | null;
  suggestedSlug: string;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
  pathUrl: string | null;
  subdomainUrl: string | null;
  domains: SiteDomainInfo[];
  domainApiConfigured: boolean;
};

async function loadWebsiteProject(ctx: ActionContext, projectId: string) {
  const { data, error } = await ctx.supabase
    .from("projects")
    .select("id, name, type")
    .eq("id", projectId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (error) throw new ActionError("internal", "Loyiha yuklanmadi");
  if (!data) throw new ActionError("not_found", "Loyiha topilmadi");
  if (data.type !== "website") throw new ActionError("validation", "Bu loyiha sayt emas");
  return data as { id: string; name: string };
}

function domainError(err: unknown): never {
  if (err instanceof DomainApiError) {
    const map: Record<DomainApiError["code"], string> = {
      not_configured: "O'z domenini ulash hali sozlanmagan. Administratorga murojaat qiling.",
      in_use: "Bu domen boshqa saytga ulangan. Avval u yerdan olib tashlang.",
      invalid: "Domen nomi noto'g'ri. Masalan: mening-dokonim.uz",
      not_found: "Domen topilmadi.",
      upstream: "Domen xizmatida vaqtinchalik xato. Keyinroq qayta urinib ko'ring.",
    };
    throw new ActionError(err.code === "upstream" ? "internal" : "validation", map[err.code]);
  }
  throw err;
}

// ===== Holat =====

export const getPublishStatus = defineAction({
  name: "getPublishStatus",
  description: "Sayt nashr qilinganmi, uning manzillari va ulangan domenlar holatini qaytaradi",
  input: z.object({ projectId: z.string().uuid() }),
  handler: async (ctx, input): Promise<PublishStatus> => {
    const project = await loadWebsiteProject(ctx, input.projectId);
    const [{ data: pub }, { data: site }, { data: domains }] = await Promise.all([
      ctx.supabase.from("published_sites").select("slug, published_at").eq("project_id", project.id).maybeSingle(),
      ctx.supabase.from("websites").select("updated_at").eq("project_id", project.id).maybeSingle(),
      ctx.supabase
        .from("site_domains")
        .select("domain, status, last_error, verification")
        .eq("project_id", project.id)
        .order("created_at"),
    ]);

    const urls = pub ? publicSiteUrls(pub.slug) : null;
    return {
      slug: pub?.slug ?? null,
      suggestedSlug: normalizeSlug(project.name) || "mening-saytim",
      publishedAt: pub?.published_at ?? null,
      hasUnpublishedChanges: !!(pub && site && new Date(site.updated_at) > new Date(pub.published_at)),
      pathUrl: urls?.pathUrl ?? null,
      subdomainUrl: urls?.subdomainUrl ?? null,
      domains: (domains ?? []).map((d) => ({
        domain: d.domain,
        status: d.status,
        lastError: d.last_error,
        records: (d.verification ?? []) as DnsRecord[],
      })),
      domainApiConfigured: isDomainApiConfigured(),
    };
  },
});

// ===== Nashr qilish =====

export const publishWebsite = defineAction({
  name: "publishWebsite",
  description:
    "Saytning saqlangan versiyasini internetga chiqaradi (yoki yangilaydi). slug — sayt manzili, masalan 'gulzor' → /s/gulzor",
  requiresConfirmation: true,
  input: z.object({
    projectId: z.string().uuid(),
    slug: z.string().max(60),
  }),
  handler: async (ctx, input): Promise<{ slug: string; publishedAt: string }> => {
    const project = await loadWebsiteProject(ctx, input.projectId);
    const slug = normalizeSlug(input.slug);
    if (!SLUG_RE.test(slug)) {
      throw new ActionError("validation", "Manzil 3–40 belgidan iborat bo'lsin: lotin harflari, raqamlar va chiziqcha (-)");
    }
    if (RESERVED_SLUGS.has(slug)) throw new ActionError("validation", "Bu manzil band qilingan. Boshqasini tanlang.");

    const { data: site } = await ctx.supabase.from("websites").select("content").eq("project_id", project.id).maybeSingle();
    const parsed = site ? siteSchema.safeParse(site.content) : null;
    if (!parsed?.success) throw new ActionError("validation", "Avval saytni yarating va saqlang");

    const { data, error } = await ctx.supabase
      .from("published_sites")
      .upsert(
        {
          project_id: project.id,
          workspace_id: ctx.workspaceId,
          slug,
          content: parsed.data,
          published_at: new Date().toISOString(),
          published_by: ctx.user.id,
        },
        { onConflict: "project_id" },
      )
      .select("slug, published_at")
      .single();

    if (error) {
      if (error.code === "23505") throw new ActionError("validation", "Bu manzil boshqa saytda ishlatilgan. Boshqasini tanlang.");
      throw new ActionError("internal", "Sayt nashr qilinmadi");
    }
    await logAudit(ctx, "website.publish", { type: "project", id: project.id }, { slug });
    return { slug: data.slug, publishedAt: data.published_at };
  },
});

export const unpublishWebsite = defineAction({
  name: "unpublishWebsite",
  description: "Saytni internetdan olib tashlaydi (tahrirlovchidagi nusxa saqlanib qoladi)",
  requiresConfirmation: true,
  input: z.object({ projectId: z.string().uuid() }),
  handler: async (ctx, input): Promise<{ ok: true }> => {
    const project = await loadWebsiteProject(ctx, input.projectId);
    const { error } = await ctx.supabase.from("published_sites").delete().eq("project_id", project.id);
    if (error) throw new ActionError("internal", "Sayt nashrdan olinmadi");
    await logAudit(ctx, "website.unpublish", { type: "project", id: project.id });
    return { ok: true };
  },
});

// ===== O'z domeni =====

export const addCustomDomain = defineAction({
  name: "addCustomDomain",
  description: "Saytga foydalanuvchining o'z domenini ulaydi (masalan dokonim.uz) va kerakli DNS yozuvlarini qaytaradi",
  requiresConfirmation: true,
  input: z.object({ projectId: z.string().uuid(), domain: z.string().max(253) }),
  handler: async (ctx, input): Promise<SiteDomainInfo> => {
    const project = await loadWebsiteProject(ctx, input.projectId);
    const domain = normalizeDomain(input.domain);
    if (!DOMAIN_RE.test(domain)) throw new ActionError("validation", "Domen nomi noto'g'ri. Masalan: mening-dokonim.uz");
    if (isPlatformDomain(domain)) throw new ActionError("validation", "Bu platformaning domeni — o'z domeningizni kiriting");
    if (!isDomainApiConfigured()) {
      throw new ActionError("forbidden", "O'z domenini ulash hali sozlanmagan. Administratorga murojaat qiling.");
    }

    const { count } = await ctx.supabase
      .from("site_domains")
      .select("domain", { count: "exact", head: true })
      .eq("project_id", project.id);
    if ((count ?? 0) >= MAX_DOMAINS_PER_SITE) {
      throw new ActionError("validation", `Bitta saytga ${MAX_DOMAINS_PER_SITE} tadan ortiq domen ulab bo'lmaydi`);
    }

    const { error: insertError } = await ctx.supabase.from("site_domains").insert({
      domain,
      project_id: project.id,
      workspace_id: ctx.workspaceId,
      created_by: ctx.user.id,
    });
    if (insertError) {
      if (insertError.code === "23505") throw new ActionError("validation", "Bu domen allaqachon ulangan");
      throw new ActionError("internal", "Domen qo'shilmadi");
    }

    try {
      const status = await addProjectDomain(domain);
      const state = status.verified && status.configured ? "active" : "pending";
      await ctx.supabase
        .from("site_domains")
        .update({ status: state, verification: status.records, last_error: null })
        .eq("domain", domain);
      await logAudit(ctx, "domain.add", { type: "domain", id: domain }, { projectId: project.id });
      return { domain, status: state, lastError: null, records: status.records };
    } catch (err) {
      await ctx.supabase.from("site_domains").delete().eq("domain", domain);
      domainError(err);
    }
  },
});

export const checkCustomDomain = defineAction({
  name: "checkCustomDomain",
  description: "Ulangan domenning DNS sozlamalarini tekshiradi va holatini yangilaydi",
  input: z.object({ projectId: z.string().uuid(), domain: z.string().max(253) }),
  handler: async (ctx, input): Promise<SiteDomainInfo> => {
    const project = await loadWebsiteProject(ctx, input.projectId);
    const domain = normalizeDomain(input.domain);
    const { data: row } = await ctx.supabase
      .from("site_domains")
      .select("domain")
      .eq("domain", domain)
      .eq("project_id", project.id)
      .maybeSingle();
    if (!row) throw new ActionError("not_found", "Domen topilmadi");

    try {
      const status = await checkProjectDomain(domain);
      const state = status.verified && status.configured ? "active" : "pending";
      const lastError = state === "active" ? null : "DNS yozuvlari hali to'g'ri sozlanmagan yoki tarqalmagan";
      await ctx.supabase
        .from("site_domains")
        .update({ status: state, verification: status.records, last_error: lastError })
        .eq("domain", domain);
      return { domain, status: state, lastError, records: status.records };
    } catch (err) {
      if (err instanceof DomainApiError && err.code !== "not_configured") {
        await ctx.supabase.from("site_domains").update({ status: "error", last_error: err.message }).eq("domain", domain);
      }
      domainError(err);
    }
  },
});

export const removeCustomDomain = defineAction({
  name: "removeCustomDomain",
  description: "Saytdan o'z domenini uzadi",
  requiresConfirmation: true,
  input: z.object({ projectId: z.string().uuid(), domain: z.string().max(253) }),
  handler: async (ctx, input): Promise<{ ok: true }> => {
    const project = await loadWebsiteProject(ctx, input.projectId);
    const domain = normalizeDomain(input.domain);
    try {
      await removeProjectDomain(domain);
    } catch (err) {
      if (!(err instanceof DomainApiError && err.code === "not_configured")) domainError(err);
    }
    const { error } = await ctx.supabase.from("site_domains").delete().eq("domain", domain).eq("project_id", project.id);
    if (error) throw new ActionError("internal", "Domen o'chirilmadi");
    await logAudit(ctx, "domain.remove", { type: "domain", id: domain }, { projectId: project.id });
    return { ok: true };
  },
});
