import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { decryptSecret } from "@/lib/crypto";
import { getWorkspacePlan } from "@/lib/plans";

/**
 * CRM'ga yangi buyurtmani yuborish.
 * Bitrix24: kiruvchi webhook (https://<portal>.bitrix24.<tld>/rest/<user>/<kod>/) — crm.contact.add + crm.deal.add / crm.lead.add.
 * AmoCRM: https://<subdomain>.amocrm.ru/api/v4/leads/complex, Authorization: Bearer <uzoq muddatli token>.
 */

export type CrmProvider = "bitrix24" | "amocrm";

export const bitrixSettingsSchema = z.object({ mode: z.enum(["deal", "lead"]).default("deal") });
export const amoSettingsSchema = z.object({
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,60}(\.amocrm\.(ru|com))?$/, "Subdomen noto'g'ri, masalan: mixpodarok"),
  pipelineId: z.string().trim().regex(/^\d{0,12}$/).default(""),
});

export class CrmError extends Error {}

type OrderForCrm = {
  id: string;
  number: number;
  customer_name: string | null;
  phone: string;
  address: string | null;
  comment: string | null;
  total: number;
  delivery_method: string;
  payment_method?: string;
  items: { name: string; qty: number; price: number }[];
};

function describe(o: OrderForCrm) {
  return [
    `Buyurtma №${o.number} (MIXBOT)`,
    ...o.items.map((i) => `• ${i.name} × ${i.qty} = ${(i.qty * i.price).toLocaleString("ru-RU")} so'm`),
    `Jami: ${Number(o.total).toLocaleString("ru-RU")} so'm`,
    `Qabul qilish: ${o.delivery_method === "courier" ? "yetkazib berish" : "olib ketish"}${o.address ? ` — ${o.address}` : ""}`,
    o.payment_method ? `To'lov: ${o.payment_method}` : "",
    o.comment ? `Izoh: ${o.comment}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function json(res: Response) {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

// ===== Bitrix24 =====
export function normalizeBitrixUrl(raw: string) {
  const u = raw.trim().replace(/\/(crm\.[a-z.]+|profile)(\.json)?\/?$/i, "").replace(/\/?$/, "/");
  if (!/^https:\/\/[a-z0-9.-]+\/rest\/\d+\/[a-z0-9]+\/$/i.test(u)) throw new CrmError("Webhook manzili https://portal.bitrix24.uz/rest/1/abc123/ ko'rinishida bo'lishi kerak");
  return u;
}

async function bitrix(url: string, method: string, body: unknown) {
  const res = await fetch(`${url}${method}.json`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res) throw new CrmError("Bitrix24 bilan aloqa yo'q");
  const d = await json(res);
  if (!res.ok || d.error) throw new CrmError(`Bitrix24: ${String(d.error_description ?? d.error ?? res.status)}`);
  return d.result;
}

export const testBitrix = (url: string) => bitrix(url, "profile", {});

async function pushBitrix(url: string, mode: "deal" | "lead", o: OrderForCrm) {
  const phone = [{ VALUE: o.phone, VALUE_TYPE: "MOBILE" }];
  const title = `MIXBOT №${o.number} — ${o.customer_name || o.phone}`;
  if (mode === "lead") {
    const id = await bitrix(url, "crm.lead.add", {
      fields: { TITLE: title, NAME: o.customer_name || "", PHONE: phone, OPPORTUNITY: o.total, CURRENCY_ID: "UZS", COMMENTS: describe(o), SOURCE_ID: "WEB", ADDRESS: o.address || "" },
    });
    return `lead:${id}`;
  }
  const contactId = await bitrix(url, "crm.contact.add", { fields: { NAME: o.customer_name || o.phone, PHONE: phone, ADDRESS: o.address || "", SOURCE_ID: "WEB" } });
  const dealId = await bitrix(url, "crm.deal.add", { fields: { TITLE: title, CONTACT_ID: contactId, OPPORTUNITY: o.total, CURRENCY_ID: "UZS", COMMENTS: describe(o), SOURCE_ID: "WEB" } });
  return `deal:${dealId}`;
}

// ===== AmoCRM =====
const amoBase = (sub: string) => `https://${sub.includes(".amocrm.") ? sub : `${sub}.amocrm.ru`}/api/v4`;

async function amo(sub: string, token: string, method: "GET" | "POST", path: string, body?: unknown) {
  const res = await fetch(`${amoBase(sub)}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res) throw new CrmError("AmoCRM bilan aloqa yo'q");
  if (res.status === 401) throw new CrmError("AmoCRM: token noto'g'ri yoki muddati tugagan");
  const d = res.status === 204 ? {} : await json(res);
  if (!res.ok) throw new CrmError(`AmoCRM: ${String(d.title ?? d.detail ?? res.status)}`);
  return d;
}

export const testAmo = (sub: string, token: string) => amo(sub, token, "GET", "/account");

async function pushAmo(sub: string, token: string, pipelineId: string, o: OrderForCrm) {
  const lead: Record<string, unknown> = {
    name: `MIXBOT №${o.number}`,
    price: Math.round(Number(o.total)),
    _embedded: {
      contacts: [{ first_name: o.customer_name || o.phone, custom_fields_values: [{ field_code: "PHONE", values: [{ value: o.phone, enum_code: "MOB" }] }] }],
      tags: [{ name: "MIXBOT" }],
    },
  };
  if (pipelineId) lead.pipeline_id = Number(pipelineId);
  const r = (await amo(sub, token, "POST", "/leads/complex", [lead])) as unknown as { id?: number }[];
  const id = Array.isArray(r) ? r[0]?.id : undefined;
  if (id) await amo(sub, token, "POST", "/leads/notes", [{ entity_id: id, note_type: "common", params: { text: describe(o) } }]).catch(() => undefined);
  return `lead:${id ?? "?"}`;
}

/** Yangi buyurtmani ulangan CRM'larga yuboradi (Biznes tarifida). Xatoni integratsiyaga yozadi. */
export async function pushOrderToCrm(db: SupabaseClient, orderId: string) {
  const { data: order } = await db
    .from("orders")
    .select("id, workspace_id, number, customer_name, phone, address, comment, total, delivery_method, payment_method, items, external_ids")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;
  const ws = order.workspace_id as string;
  const { data: rows } = await db.from("integrations").select("provider, status, settings, credentials_encrypted").eq("workspace_id", ws).in("provider", ["bitrix24", "amocrm"]);
  const active = (rows ?? []).filter((r) => r.status === "active");
  if (!active.length) return;
  if (!(await getWorkspacePlan(db, ws)).integrations) return;
  const ext: Record<string, string> = { ...((order.external_ids as Record<string, string> | null) ?? {}) };
  for (const r of active) {
    const provider = r.provider as CrmProvider;
    if (ext[provider]) continue;
    try {
      const creds = JSON.parse(decryptSecret(r.credentials_encrypted as string)) as { url?: string; token?: string };
      if (provider === "bitrix24") {
        const s = bitrixSettingsSchema.parse(r.settings ?? {});
        ext.bitrix24 = await pushBitrix(creds.url ?? "", s.mode, order as unknown as OrderForCrm);
      } else {
        const s = amoSettingsSchema.parse(r.settings ?? {});
        ext.amocrm = await pushAmo(s.subdomain, creds.token ?? "", s.pipelineId, order as unknown as OrderForCrm);
      }
      await db.from("integrations").update({ last_error: null, last_sync_at: new Date().toISOString() }).eq("workspace_id", ws).eq("provider", provider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "CRM xatosi";
      await db.from("integrations").update({ last_error: `№${order.number}: ${msg}`.slice(0, 300) }).eq("workspace_id", ws).eq("provider", provider);
    }
  }
  const { data: fresh } = await db.from("orders").select("external_ids").eq("id", orderId).maybeSingle();
  await db
    .from("orders")
    .update({ external_ids: { ...((fresh?.external_ids as Record<string, string> | null) ?? {}), ...ext } })
    .eq("id", orderId);
}
