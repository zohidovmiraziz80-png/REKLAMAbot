import { z } from "zod";
import { AIError, callClaudeTool } from "@/lib/ai/claude";
import { isAiEnabled } from "@/lib/ai/config";
import { TEMPLATE_IDS, buildFromTemplate } from "@/lib/site/templates";
import { SITE_SYSTEM_PROMPT, buildEditMessage, buildGenerateMessage } from "@/lib/ai/site-prompts";
import { siteSchema, type Block, type Site } from "@/lib/site/schema";
import { SITE_TOOL } from "@/lib/site/tool-schema";
import { normalizeUzPhone, formatUzPhone } from "@/lib/phone";
import { ActionError, defineAction, type ActionContext } from "./define";
import { logAudit } from "./audit";
import { requireFeature } from "./plan-guard";

const AI_DAILY_LIMIT = 30;

export type WebsiteRecord = {
  projectId: string;
  projectName: string;
  content: Site | null;
  version: number;
  updatedAt: string | null;
};

async function loadProject(ctx: ActionContext, projectId: string) {
  const { data, error } = await ctx.supabase
    .from("projects")
    .select("id, name, type")
    .eq("id", projectId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (error) throw new ActionError("internal", "Loyiha yuklanmadi");
  if (!data) throw new ActionError("not_found", "Loyiha topilmadi");
  if (data.type !== "website") throw new ActionError("validation", "Bu loyiha sayt emas");
  return data as { id: string; name: string; type: string };
}

async function assertAiQuota(ctx: ActionContext) {
  if (!isAiEnabled()) {
    throw new ActionError("forbidden", "AI funksiyalari hozircha yoqilmagan. Saytni shablon orqali yarating va qo'lda tahrirlang.");
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await ctx.supabase
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ctx.workspaceId)
    .in("action", ["website.ai_generate", "website.ai_edit"])
    .gte("created_at", since);
  if (error) throw new ActionError("internal", "Limitni tekshirib bo'lmadi");
  if ((count ?? 0) >= AI_DAILY_LIMIT) {
    throw new ActionError("forbidden", `Bir kunda ${AI_DAILY_LIMIT} ta AI so'rovi limiti tugadi. Ertaga qayta urinib ko'ring.`);
  }
}

function aiErrorToAction(err: unknown): never {
  if (err instanceof AIError) {
    const messages: Record<AIError["code"], string> = {
      not_configured: "AI xizmati hali ulanmagan. Administratorga murojaat qiling.",
      no_credit: "AI hisobida mablag' tugagan. Administratorga murojaat qiling.",
      rate_limited: "AI hozir band. Bir daqiqadan keyin qayta urinib ko'ring.",
      timeout: "AI javob berishga ulgurmadi. Tavsifni qisqartirib, qayta urinib ko'ring.",
      bad_output: "AI noto'g'ri javob qaytardi. Qayta urinib ko'ring.",
      upstream: "AI xizmatida vaqtinchalik xato. Qayta urinib ko'ring.",
    };
    throw new ActionError("internal", messages[err.code]);
  }
  throw err;
}

function parseSite(raw: unknown): Site {
  const parsed = siteSchema.safeParse(raw);
  if (!parsed.success) throw new ActionError("internal", "AI natijasi sayt tuzilmasiga mos kelmadi. Qayta urinib ko'ring.");
  return parsed.data;
}

async function saveContent(
  ctx: ActionContext,
  projectId: string,
  content: Site,
  extra: { brief?: unknown; expectedVersion?: number } = {},
) {
  const { data: existing } = await ctx.supabase
    .from("websites")
    .select("version")
    .eq("project_id", projectId)
    .maybeSingle();

  if (!existing) {
    const { data, error } = await ctx.supabase
      .from("websites")
      .insert({
        project_id: projectId,
        workspace_id: ctx.workspaceId,
        content,
        brief: extra.brief ?? {},
        updated_by: ctx.user.id,
      })
      .select("version, updated_at")
      .single();
    if (error || !data) throw new ActionError("internal", "Sayt saqlanmadi");
    return data as { version: number; updated_at: string };
  }

  if (extra.expectedVersion !== undefined && existing.version !== extra.expectedVersion) {
    throw new ActionError("validation", "Sayt boshqa oynada o'zgartirilgan. Sahifani yangilab, qayta urinib ko'ring.");
  }

  const update: Record<string, unknown> = {
    content,
    version: existing.version + 1,
    updated_by: ctx.user.id,
  };
  if (extra.brief) update.brief = extra.brief;

  const { data, error } = await ctx.supabase
    .from("websites")
    .update(update)
    .eq("project_id", projectId)
    .eq("version", existing.version)
    .select("version, updated_at")
    .maybeSingle();
  if (error) throw new ActionError("internal", "Sayt saqlanmadi");
  if (!data) throw new ActionError("validation", "Sayt boshqa oynada o'zgartirilgan. Sahifani yangilab, qayta urinib ko'ring.");
  return data as { version: number; updated_at: string };
}

/** AI tahriri testimonials bloklarini qaytarmaydi — ularni avvalgi joyiga qo'yamiz */
function keepTestimonials(before: Site, after: Site): Site {
  for (const oldPage of before.pages) {
    const kept = oldPage.blocks
      .map((b, index) => ({ b, index }))
      .filter(({ b }) => b.type === "testimonials");
    if (!kept.length) continue;
    const target = after.pages.find((p) => p.slug === oldPage.slug) ?? after.pages[0];
    for (const { b, index } of kept) {
      if (target.blocks.some((x) => x.type === "testimonials")) break;
      target.blocks.splice(Math.min(index, target.blocks.length), 0, b as Block);
    }
  }
  return siteSchema.parse(after);
}

// ===== Amallar =====

export const getWebsite = defineAction({
  name: "getWebsite",
  description: "Sayt loyihasining joriy tuzilmasini (sahifalar, bloklar, mavzu) qaytaradi",
  input: z.object({ projectId: z.string().uuid() }),
  handler: async (ctx, input): Promise<WebsiteRecord> => {
    const project = await loadProject(ctx, input.projectId);
    const { data, error } = await ctx.supabase
      .from("websites")
      .select("content, version, updated_at")
      .eq("project_id", input.projectId)
      .maybeSingle();
    if (error) throw new ActionError("internal", "Sayt yuklanmadi");

    const parsed = data ? siteSchema.safeParse(data.content) : null;
    return {
      projectId: project.id,
      projectName: project.name,
      content: parsed?.success ? parsed.data : null,
      version: data?.version ?? 0,
      updatedAt: data?.updated_at ?? null,
    };
  },
});

export const createWebsiteFromTemplate = defineAction({
  name: "createWebsiteFromTemplate",
  description:
    "Tayyor shablondan sayt yaratadi (AI'siz). Shablonlar: shop, flowers, food, services, beauty, blank. Mavjud sayt bo'lsa, u almashtiriladi",
  requiresConfirmation: false,
  input: z.object({
    projectId: z.string().uuid(),
    templateId: z.enum(TEMPLATE_IDS),
    details: z.object({
      businessName: z.string().trim().min(2, "Biznes nomini kiriting").max(60),
      phone: z.string().trim().max(30).optional().default(""),
      telegram: z.string().trim().max(64).optional().default(""),
      instagram: z.string().trim().max(64).optional().default(""),
      address: z.string().trim().max(200).optional().default(""),
    }),
  }),
  handler: async (ctx, input): Promise<WebsiteRecord> => {
    const project = await loadProject(ctx, input.projectId);
    await requireFeature(ctx, "sites");
    const phone = input.details.phone ? normalizeUzPhone(input.details.phone) : null;
    if (input.details.phone && !phone) {
      throw new ActionError("validation", "Telefon raqami noto'g'ri. Masalan: +998 90 123 45 67");
    }
    const site = buildFromTemplate(input.templateId, {
      ...input.details,
      phone: phone ? formatUzPhone(phone) : "",
    });
    const saved = await saveContent(ctx, project.id, site, { brief: { template: input.templateId, ...input.details } });
    await logAudit(ctx, "website.create_from_template", { type: "project", id: project.id }, { template: input.templateId });
    return { projectId: project.id, projectName: project.name, content: site, version: saved.version, updatedAt: saved.updated_at };
  },
});

export const briefSchema = z.object({
  businessName: z.string().trim().min(2, "Biznes nomini kiriting").max(60),
  description: z
    .string()
    .trim()
    .min(20, "Biznesingiz haqida batafsilroq yozing (kamida 20 belgi)")
    .max(2000, "Tavsif 2000 belgidan oshmasin"),
  style: z.enum(["modern", "classic", "bright", "minimal"]).default("modern"),
  language: z.enum(["uz", "ru", "en"]).default("uz"),
  phone: z.string().trim().max(30).optional().default(""),
  telegram: z.string().trim().max(64).optional().default(""),
  instagram: z.string().trim().max(64).optional().default(""),
  address: z.string().trim().max(200).optional().default(""),
});

export const generateWebsite = defineAction({
  name: "generateWebsite",
  description:
    "Biznes tavsifi asosida AI yordamida sayt yaratadi (sahifalar, matnlar, ranglar). Mavjud sayt bo'lsa, u to'liq almashtiriladi",
  requiresConfirmation: false,
  input: z.object({ projectId: z.string().uuid(), brief: briefSchema }),
  handler: async (ctx, input): Promise<WebsiteRecord> => {
    const project = await loadProject(ctx, input.projectId);
    await assertAiQuota(ctx);

    const phone = input.brief.phone ? normalizeUzPhone(input.brief.phone) : null;
    const brief = { ...input.brief, phone: phone ? formatUzPhone(phone) : input.brief.phone };

    let raw: unknown;
    try {
      raw = await callClaudeTool({
        system: SITE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildGenerateMessage(brief) }],
        tool: SITE_TOOL as unknown as { name: string; description: string; input_schema: Record<string, unknown> },
      });
    } catch (err) {
      aiErrorToAction(err);
    }

    const site = parseSite(raw);
    // Foydalanuvchi bergan aloqa ma'lumotlarini AI yo'qotgan bo'lsa ham kafolatlaymiz
    for (const page of site.pages) {
      for (const b of page.blocks) {
        if (b.type === "contact") {
          b.phone = b.phone || brief.phone || "";
          b.telegram = b.telegram || brief.telegram || "";
          b.instagram = b.instagram || brief.instagram || "";
          b.address = b.address || brief.address || "";
        }
      }
    }

    const saved = await saveContent(ctx, project.id, site, { brief });
    await logAudit(ctx, "website.ai_generate", { type: "project", id: project.id }, { style: brief.style });
    return { projectId: project.id, projectName: project.name, content: site, version: saved.version, updatedAt: saved.updated_at };
  },
});

export const editWebsiteWithAI = defineAction({
  name: "editWebsiteWithAI",
  description:
    "Mavjud saytni matnli ko'rsatma bo'yicha AI yordamida o'zgartiradi (masalan: 'ranglarni yashil qil', 'narxlar bo'limini qo'sh')",
  input: z.object({
    projectId: z.string().uuid(),
    instruction: z.string().trim().min(3, "Nima o'zgarishini yozing").max(1000),
    expectedVersion: z.number().int().optional(),
  }),
  handler: async (ctx, input): Promise<WebsiteRecord> => {
    const project = await loadProject(ctx, input.projectId);
    const { data } = await ctx.supabase
      .from("websites")
      .select("content, version")
      .eq("project_id", project.id)
      .maybeSingle();
    const current = data ? siteSchema.safeParse(data.content) : null;
    if (!current?.success) throw new ActionError("not_found", "Avval saytni yarating");
    if (input.expectedVersion !== undefined && data!.version !== input.expectedVersion) {
      throw new ActionError("validation", "Avval o'zgarishlarni saqlang, keyin AI'dan foydalaning.");
    }
    await assertAiQuota(ctx);

    let raw: unknown;
    try {
      raw = await callClaudeTool({
        system: SITE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildEditMessage(current.data, input.instruction) }],
        tool: SITE_TOOL as unknown as { name: string; description: string; input_schema: Record<string, unknown> },
      });
    } catch (err) {
      aiErrorToAction(err);
    }

    const site = keepTestimonials(current.data, parseSite(raw));
    const saved = await saveContent(ctx, project.id, site, { expectedVersion: data!.version });
    await logAudit(ctx, "website.ai_edit", { type: "project", id: project.id }, { instruction: input.instruction.slice(0, 200) });
    return { projectId: project.id, projectName: project.name, content: site, version: saved.version, updatedAt: saved.updated_at };
  },
});

export const saveWebsite = defineAction({
  name: "saveWebsite",
  description: "Tahrirlovchida o'zgartirilgan sayt tuzilmasini saqlaydi",
  input: z.object({
    projectId: z.string().uuid(),
    content: z.unknown(),
    expectedVersion: z.number().int().optional(),
  }),
  handler: async (ctx, input): Promise<{ version: number; updatedAt: string }> => {
    const project = await loadProject(ctx, input.projectId);
    const parsed = siteSchema.safeParse(input.content);
    if (!parsed.success) throw new ActionError("validation", "Sayt tuzilmasida xato bor");
    const saved = await saveContent(ctx, project.id, parsed.data, { expectedVersion: input.expectedVersion });
    await logAudit(ctx, "website.save", { type: "project", id: project.id }, { version: saved.version });
    return { version: saved.version, updatedAt: saved.updated_at };
  },
});
