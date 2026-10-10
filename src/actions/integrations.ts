import { z } from "zod";
import { isEncryptionConfigured } from "@/lib/crypto";
import {
  BitoError,
  getEmployees,
  getMe,
  getOrganizations,
  getPrices,
  getWarehouses,
  type BitoEmployee,
  type BitoOrganization,
  type BitoPrice,
  type BitoWarehouse,
} from "@/lib/integrations/bito";
import { pushOrderToBito, syncBitoProducts, type SyncResult } from "@/lib/integrations/bito-sync";
import { bitoSettingsSchema, encryptCreds, keyHint, loadIntegration, type BitoSettings } from "@/lib/integrations/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionError, defineAction, type ActionContext } from "./define";
import { logAudit } from "./audit";

/**
 * Integratsiyalar: mijoz o'z kalitini o'zi kiritadi. Kalit shifrlanadi va hech qachon brauzerga qaytmaydi.
 */

export type IntegrationSummary = {
  provider: string;
  status: "active" | "error" | "disabled";
  keyHint: string | null;
  lastSyncAt: string | null;
  lastSyncResult: SyncResult | null;
  lastError: string | null;
  syncing: boolean;
};

async function summaries(ctx: ActionContext): Promise<IntegrationSummary[]> {
  const { data } = await ctx.supabase
    .from("integrations")
    .select("provider, status, key_hint, last_sync_at, last_sync_result, last_error, sync_started_at")
    .eq("workspace_id", ctx.workspaceId);
  const fresh = Date.now() - 15 * 60_000;
  return (data ?? []).map((r) => ({
    provider: r.provider as string,
    status: r.status as IntegrationSummary["status"],
    keyHint: (r.key_hint as string | null) ?? null,
    lastSyncAt: (r.last_sync_at as string | null) ?? null,
    lastSyncResult: (r.last_sync_result as SyncResult | null) ?? null,
    lastError: (r.last_error as string | null) ?? null,
    syncing: !!r.sync_started_at && new Date(r.sync_started_at as string).getTime() > fresh,
  }));
}

export const listIntegrations = defineAction({
  name: "listIntegrations",
  description: "Ulangan integratsiyalar (Bito, to'lovlar, yetkazish) va ularning holati.",
  input: z.object({}),
  handler: async (ctx) => summaries(ctx),
});

function bitoFail(err: unknown): never {
  if (err instanceof BitoError) throw new ActionError("validation", err.message);
  throw err;
}

export const connectBito = defineAction({
  name: "connectBito",
  description: "Bito ERP'ni ulaydi. Kalit Bito → Integratsiya bo'limidan olinadi (username:secret ko'rinishida).",
  input: z.object({ apiKey: z.string().trim().min(5).max(300) }),
  minRole: "admin",
  handler: async (ctx, input) => {
    const apiKey = input.apiKey.replace(/^api-key:\s*/i, "").trim();
    if (!/^[^\s:]+:[^\s]+$/.test(apiKey)) {
      throw new ActionError("validation", "Kalit username:secret ko'rinishida bo'lishi kerak. Bito → Integratsiya bo'limidan to'liq nusxalang.");
    }
    if (!isEncryptionConfigured()) throw new ActionError("internal", "Server shifrlash kaliti sozlanmagan");

    const creds = { apiKey };
    let orgs: BitoOrganization[] = [];
    let prices: BitoPrice[] = [];
    let warehouses: BitoWarehouse[] = [];
    let employees: BitoEmployee[] = [];
    try {
      await getMe(creds);
      [orgs, prices, warehouses, employees] = await Promise.all([
        getOrganizations(creds),
        getPrices(creds),
        getWarehouses(creds).catch(() => [] as BitoWarehouse[]),
        getEmployees(creds).catch(() => [] as BitoEmployee[]),
      ]);
    } catch (err) {
      bitoFail(err);
    }

    const org = orgs.find((o) => o.is_default) ?? orgs[0];
    const settings: BitoSettings = bitoSettingsSchema.parse({
      organizationId: org?._id ?? "",
      priceId: (prices.find((p) => p.is_main && p.type === "sale") ?? prices.find((p) => p.type === "sale"))?._id ?? "",
      warehouseId: (warehouses.find((w) => w.is_main && (!org || w.organization_id === org._id)) ?? warehouses[0])?._id ?? "",
      responsibleId: employees[0]?._id ?? "",
      syncProducts: true,
      sendOrders: true,
      onlyInStock: true,
      orderState: "new",
      imageHost: null,
    });

    const db = createAdminClient();
    const { error } = await db.from("integrations").upsert(
      {
        workspace_id: ctx.workspaceId,
        provider: "bito",
        status: "active",
        credentials_encrypted: encryptCreds(creds),
        key_hint: keyHint(apiKey),
        settings,
        last_error: null,
        created_by: ctx.user.id,
      },
      { onConflict: "workspace_id,provider" },
    );
    if (error) throw new ActionError("internal", "Saqlanmadi");
    await logAudit(ctx, "integration.connect", { type: "integration", id: "bito" });
    return { ok: true };
  },
});

export type BitoSetup = {
  connected: boolean;
  summary: IntegrationSummary | null;
  settings: BitoSettings | null;
  options: { organizations: BitoOrganization[]; prices: BitoPrice[]; warehouses: BitoWarehouse[]; employees: BitoEmployee[] } | null;
  optionsError: string | null;
  linkedProducts: number;
};

export const getBitoSetup = defineAction({
  name: "getBitoSetup",
  description: "Bito integratsiyasi holati, sozlamalari va tanlash uchun ro'yxatlar (filiallar, narx turlari, omborlar, xodimlar).",
  input: z.object({}),
  handler: async (ctx): Promise<BitoSetup> => {
    const summary = (await summaries(ctx)).find((s) => s.provider === "bito") ?? null;
    if (!summary) return { connected: false, summary: null, settings: null, options: null, optionsError: null, linkedProducts: 0 };

    const db = createAdminClient();
    const integ = await loadIntegration(db, ctx.workspaceId, "bito");
    if (!integ) return { connected: false, summary: null, settings: null, options: null, optionsError: null, linkedProducts: 0 };

    const { count } = await ctx.supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .eq("external_source", "bito");

    const creds = { apiKey: integ.creds.apiKey ?? "" };
    try {
      const [organizations, prices, warehouses, employees] = await Promise.all([
        getOrganizations(creds),
        getPrices(creds),
        getWarehouses(creds).catch(() => [] as BitoWarehouse[]),
        getEmployees(creds).catch(() => [] as BitoEmployee[]),
      ]);
      return {
        connected: true,
        summary,
        settings: integ.settings,
        options: {
          organizations: organizations.map((o) => ({ _id: o._id, name: o.name, is_default: o.is_default })),
          prices: prices.map((p) => ({ _id: p._id, name: p.name, type: p.type, status: p.status, is_main: p.is_main })),
          warehouses: warehouses.map((w) => ({ _id: w._id, name: w.name, organization_id: w.organization_id, is_main: w.is_main })),
          employees: employees.map((e) => ({ _id: e._id, full_name: e.full_name })),
        },
        optionsError: null,
        linkedProducts: count ?? 0,
      };
    } catch (err) {
      return {
        connected: true,
        summary,
        settings: integ.settings,
        options: null,
        optionsError: err instanceof Error ? err.message : "Bito'dan ma'lumot olib bo'lmadi",
        linkedProducts: count ?? 0,
      };
    }
  },
});

export const saveBitoSettings = defineAction({
  name: "saveBitoSettings",
  description: "Bito sozlamalari: filial, narx turi, ombor, mas'ul xodim, mahsulotlarni olish, buyurtmalarni yuborish.",
  input: z.object({
    organizationId: z.string().max(64),
    priceId: z.string().max(64),
    warehouseId: z.string().max(64),
    responsibleId: z.string().max(64),
    syncProducts: z.boolean(),
    sendOrders: z.boolean(),
    onlyInStock: z.boolean(),
    orderState: z.enum(["new", "draft", "in_progress"]),
  }),
  minRole: "admin",
  handler: async (ctx, input) => {
    const db = createAdminClient();
    const integ = await loadIntegration(db, ctx.workspaceId, "bito");
    if (!integ) throw new ActionError("not_found", "Avval Bito'ni ulang");
    const settings = bitoSettingsSchema.parse({ ...integ.settings, ...input });
    const { error } = await db.from("integrations").update({ settings }).eq("workspace_id", ctx.workspaceId).eq("provider", "bito");
    if (error) throw new ActionError("internal", "Saqlanmadi");
    return { ok: true };
  },
});

export const syncBitoNow = defineAction({
  name: "syncBitoNow",
  description: "Mahsulotlar, narxlar va qoldiqni hozir Bito'dan yangilaydi.",
  input: z.object({}),
  minRole: "admin",
  handler: async (ctx): Promise<SyncResult> => {
    const { data } = await ctx.supabase.from("integrations").select("provider").eq("workspace_id", ctx.workspaceId).eq("provider", "bito").maybeSingle();
    if (!data) throw new ActionError("not_found", "Avval Bito'ni ulang");
    try {
      return await syncBitoProducts(createAdminClient(), ctx.workspaceId);
    } catch (err) {
      bitoFail(err);
    }
  },
});

export const retryOrderSync = defineAction({
  name: "retryOrderSync",
  description: "Buyurtmani Bito'ga qayta yuboradi.",
  input: z.object({ orderId: z.string().uuid() }),
  handler: async (ctx, input) => {
    const { data } = await ctx.supabase.from("orders").select("id").eq("id", input.orderId).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!data) throw new ActionError("not_found", "Buyurtma topilmadi");
    const r = await pushOrderToBito(createAdminClient(), input.orderId);
    if (!r.ok) throw new ActionError("validation", r.error ?? "Yuborilmadi");
    return { ok: true };
  },
});

export const disconnectIntegration = defineAction({
  name: "disconnectIntegration",
  description: "Integratsiyani uzadi va kalitni o'chiradi. Olingan mahsulotlar saqlanib qoladi.",
  input: z.object({ provider: z.enum(["bito", "payme", "click", "multicard", "yandex", "bts", "fargo", "eskiz", "amocrm", "bitrix24"]) }),
  requiresConfirmation: true,
  minRole: "admin",
  handler: async (ctx, input) => {
    const db = createAdminClient();
    const { error } = await db.from("integrations").delete().eq("workspace_id", ctx.workspaceId).eq("provider", input.provider);
    if (error) throw new ActionError("internal", "Uzib bo'lmadi");
    await logAudit(ctx, "integration.disconnect", { type: "integration", id: input.provider });
    return { ok: true };
  },
});
