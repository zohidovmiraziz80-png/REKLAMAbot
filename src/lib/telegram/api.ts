/**
 * Telegram Bot API bilan ishlash. Token hech qachon logga yozilmaydi.
 */

export class TelegramError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function tg<T = unknown>(token: string, method: string, body: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new TelegramError(0, "Telegram'ga ulanib bo'lmadi");
  }
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; error_code?: number; description?: string };
  if (!data.ok) throw new TelegramError(data.error_code ?? res.status, data.description ?? "Telegram xatosi");
  return data.result as T;
}

export const BOT_TOKEN_RE = /^\d{5,15}:[A-Za-z0-9_-]{30,50}$/;

export type TgBotInfo = { id: number; is_bot: boolean; username: string; first_name: string };
