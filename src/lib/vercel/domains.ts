/**
 * Vercel REST API orqali o'z domenlarini platforma loyihasiga ulash.
 * Kerakli muhit o'zgaruvchilari (Vercel → Settings → Environment Variables):
 *   VERCEL_API_TOKEN  — Vercel Account Settings → Tokens (maxfiy)
 *   VERCEL_PROJECT_ID — platforma loyihasining ID'si yoki nomi
 *   VERCEL_TEAM_ID    — jamoa ID'si (team_...)
 */

const API = "https://api.vercel.com";

export class DomainApiError extends Error {
  constructor(
    public code: "not_configured" | "in_use" | "invalid" | "not_found" | "upstream",
    message: string,
  ) {
    super(message);
  }
}

export type DnsRecord = { type: "A" | "CNAME" | "TXT"; name: string; value: string; reason: string };

export type DomainStatus = {
  verified: boolean;
  configured: boolean;
  records: DnsRecord[];
};

function config() {
  const token = process.env.VERCEL_API_TOKEN;
  const project = process.env.VERCEL_PROJECT_ID;
  const team = process.env.VERCEL_TEAM_ID;
  if (!token || !project) return null;
  return { token, project, team };
}

export function isDomainApiConfigured() {
  return config() !== null;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const cfg = config();
  if (!cfg) throw new DomainApiError("not_configured", "Domen xizmati sozlanmagan");
  const url = new URL(API + path);
  if (cfg.team) url.searchParams.set("teamId", cfg.team);
  const res = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } } & T;
  if (!res.ok) {
    const code = data.error?.code ?? "";
    console.error("Vercel API xatosi", res.status, code, data.error?.message);
    if (res.status === 404) throw new DomainApiError("not_found", "Domen topilmadi");
    if (code === "domain_already_in_use" || code === "domain_taken" || res.status === 409) {
      throw new DomainApiError("in_use", "Bu domen boshqa loyihaga ulangan");
    }
    if (code.includes("invalid") || res.status === 400) throw new DomainApiError("invalid", "Domen nomi noto'g'ri");
    throw new DomainApiError("upstream", "Domen xizmatida xato");
  }
  return data as T;
}

function project() {
  return encodeURIComponent(config()!.project);
}

/** Domen apex (example.uz) yoki subdomen (shop.example.uz)ligini aniqlaydi */
function isApex(domain: string) {
  return domain.split(".").length === 2;
}

function baseRecords(domain: string): DnsRecord[] {
  if (isApex(domain)) {
    return [{ type: "A", name: "@", value: "76.76.21.21", reason: "Domenni saytga yo'naltiradi" }];
  }
  const sub = domain.split(".").slice(0, -2).join(".");
  return [{ type: "CNAME", name: sub, value: "cname.vercel-dns.com", reason: "Subdomenni saytga yo'naltiradi" }];
}

type ProjectDomain = {
  name: string;
  verified: boolean;
  verification?: { type: string; domain: string; value: string; reason: string }[];
};

function toStatus(domain: string, pd: ProjectDomain, misconfigured: boolean): DomainStatus {
  const extra: DnsRecord[] = (pd.verification ?? [])
    .filter((v) => v.type === "TXT")
    .map((v) => ({
      type: "TXT",
      name: v.domain.replace(new RegExp(`\\.${domain.split(".").slice(-2).join("\\.")}$`), "") || "@",
      value: v.value,
      reason: "Domen sizniki ekanini tasdiqlaydi",
    }));
  return {
    verified: pd.verified,
    configured: !misconfigured,
    records: [...baseRecords(domain), ...extra],
  };
}

async function misconfigured(domain: string) {
  try {
    const cfg = await call<{ misconfigured: boolean }>("GET", `/v6/domains/${encodeURIComponent(domain)}/config`);
    return cfg.misconfigured;
  } catch {
    return true;
  }
}

export async function addProjectDomain(domain: string): Promise<DomainStatus> {
  const pd = await call<ProjectDomain>("POST", `/v10/projects/${project()}/domains`, { name: domain });
  return toStatus(domain, pd, await misconfigured(domain));
}

export async function checkProjectDomain(domain: string): Promise<DomainStatus> {
  let pd = await call<ProjectDomain>("GET", `/v9/projects/${project()}/domains/${encodeURIComponent(domain)}`);
  if (!pd.verified) {
    try {
      pd = await call<ProjectDomain>("POST", `/v9/projects/${project()}/domains/${encodeURIComponent(domain)}/verify`);
    } catch {
      // hali tasdiqlanmagan — yozuvlar ko'rsatiladi
    }
  }
  return toStatus(domain, pd, await misconfigured(domain));
}

export async function removeProjectDomain(domain: string) {
  try {
    await call("DELETE", `/v9/projects/${project()}/domains/${encodeURIComponent(domain)}`);
  } catch (err) {
    if (err instanceof DomainApiError && err.code === "not_found") return;
    throw err;
  }
}
