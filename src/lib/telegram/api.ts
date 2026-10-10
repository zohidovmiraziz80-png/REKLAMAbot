/**
 * Telegram Bot API bilan ishlash. Token hech qachon logga yozilmaydi.
 */

export class TelegramError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** "Too Many Requests: retry after N" bo'lsa, ko'rsatilgan vaqt kutib bir marta qayta urinadi */
export async function tg<T = unknown>(token: string, method: string, body: Record<string, unknown> = {}): Promise<T> {
  try {
    return await tgOnce<T>(token, method, body);
  } catch (err) {
    if (err instanceof TelegramError && err.status === 429 && err.retryAfter !== undefined && err.retryAfter <= 5) {
      await sleep((err.retryAfter + 0.5) * 1000);
      return tgOnce<T>(token, method, body);
    }
    throw err;
  }
}

async function tgOnce<T>(token: string, method: string, body: Record<string, unknown>): Promise<T> {
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
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: T;
    error_code?: number;
    description?: string;
    parameters?: { retry_after?: number };
  };
  if (!data.ok) {
    throw new TelegramError(data.error_code ?? res.status, data.description ?? "Telegram xatosi", data.parameters?.retry_after);
  }
  return data.result as T;
}

export const BOT_TOKEN_RE = /^\d{5,15}:[A-Za-z0-9_-]{30,50}$/;

export type TgBotInfo = { id: number; is_bot: boolean; username: string; first_name: string };
