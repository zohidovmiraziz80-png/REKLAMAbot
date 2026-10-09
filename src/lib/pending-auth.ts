import { cookies } from "next/headers";

/**
 * Kod tasdiqlanayotgan email'ni qisqa muddatli cookie'da saqlaydi,
 * shunda email URL'da ko'rinmaydi va kod sahifasi qaysi email uchun ekanini biladi.
 */
const COOKIE = "tz_pending_auth";
const MAX_AGE = 60 * 30; // 30 daqiqa

export type PendingPurpose = "signup" | "recovery";
export type PendingAuth = { email: string; purpose: PendingPurpose };

export async function setPendingAuth(value: PendingAuth) {
  const store = await cookies();
  store.set(COOKIE, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getPendingAuth(purpose: PendingPurpose): Promise<PendingAuth | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingAuth;
    if (parsed.purpose !== purpose || typeof parsed.email !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingAuth() {
  const store = await cookies();
  store.delete(COOKIE);
}

/** a****@gmail.com ko'rinishida yashiradi */
export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(1, name.length - visible.length))}@${domain}`;
}
