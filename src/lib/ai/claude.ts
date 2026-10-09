import { headers } from "next/headers";

/**
 * Claude'ga so'rov yuboradi va majburiy tool chaqiruvining input'ini qaytaradi.
 *
 * Kirish (autentifikatsiya) tartibi:
 * 1. AI_GATEWAY_API_KEY bo'lsa → Vercel AI Gateway
 * 2. ANTHROPIC_API_KEY bo'lsa → to'g'ridan-to'g'ri Anthropic API
 * 3. Aks holda → Vercel AI Gateway, Vercel bergan OIDC token bilan (kalit kerak emas)
 */

type Tool = { name: string; description: string; input_schema: Record<string, unknown> };
type Message = { role: "user" | "assistant"; content: string };

export class AIError extends Error {
  constructor(
    public code: "not_configured" | "no_credit" | "rate_limited" | "timeout" | "bad_output" | "upstream",
    message: string,
  ) {
    super(message);
  }
}

const GATEWAY_MODEL = process.env.AI_MODEL ?? "anthropic/claude-sonnet-5.5";
const DIRECT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";

type Endpoint = { url: string; headers: Record<string, string>; model: string };

async function resolveEndpoint(): Promise<Endpoint> {
  if (process.env.AI_GATEWAY_API_KEY) {
    return {
      url: "https://ai-gateway.vercel.sh/v1/messages",
      headers: { authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}` },
      model: GATEWAY_MODEL,
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      url: "https://api.anthropic.com/v1/messages",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY },
      model: DIRECT_MODEL,
    };
  }
  let oidc: string | null = null;
  try {
    oidc = (await headers()).get("x-vercel-oidc-token");
  } catch {
    // so'rov kontekstidan tashqarida
  }
  oidc = oidc || process.env.VERCEL_OIDC_TOKEN || null;
  if (!oidc) throw new AIError("not_configured", "AI xizmati ulanmagan");
  return {
    url: "https://ai-gateway.vercel.sh/v1/messages",
    headers: { authorization: `Bearer ${oidc}` },
    model: GATEWAY_MODEL,
  };
}

export async function callClaudeTool({
  system,
  messages,
  tool,
  maxTokens = 8000,
  timeoutMs = 110_000,
}: {
  system: string;
  messages: Message[];
  tool: Tool;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<unknown> {
  const endpoint = await resolveEndpoint();

  let res: Response;
  try {
    res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        ...endpoint.headers,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: endpoint.model,
        max_tokens: maxTokens,
        system,
        messages,
        tools: [tool],
        tool_choice: { type: "tool", name: tool.name },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new AIError("timeout", "AI javob berishga ulgurmadi");
    }
    throw new AIError("upstream", "AI xizmatiga ulanib bo'lmadi");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("AI xatosi", res.status, body.slice(0, 500));
    if (res.status === 401 || res.status === 403) {
      throw new AIError("not_configured", "AI xizmatiga kirish ruxsati yo'q");
    }
    if (res.status === 402 || /credit|billing|balance/i.test(body)) {
      throw new AIError("no_credit", "AI hisobida mablag' tugagan");
    }
    if (res.status === 429) throw new AIError("rate_limited", "AI band, birozdan keyin urinib ko'ring");
    throw new AIError("upstream", "AI xizmatida xato");
  }

  const data = (await res.json()) as {
    content?: { type: string; name?: string; input?: unknown }[];
    stop_reason?: string;
  };
  const call = data.content?.find((c) => c.type === "tool_use" && c.name === tool.name);
  if (!call?.input) throw new AIError("bad_output", "AI to'g'ri javob qaytarmadi");
  return call.input;
}
