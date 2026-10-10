"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ChatMessage, Conversation } from "@/actions/chat";
import { getConversationAction, listConversationsAction, sendChatReplyAction } from "./actions";

const TZ = 5 * 3600 * 1000;
function when(iso: string) {
  const d = new Date(new Date(iso).getTime() + TZ);
  const today = new Date(Date.now() + TZ).toISOString().slice(0, 10);
  const hm = d.toISOString().slice(11, 16);
  return d.toISOString().slice(0, 10) === today ? hm : `${d.toISOString().slice(8, 10)}.${d.toISOString().slice(5, 7)} ${hm}`;
}

export function ChatView({ initial }: { initial: Conversation[] }) {
  const [list, setList] = useState(initial);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  // Yangi xabarlarni tekshirib turish
  useEffect(() => {
    const t = setInterval(async () => {
      const r = await listConversationsAction();
      if (r.ok) setList(r.data.conversations);
      if (active) {
        const m = await getConversationAction(active.projectId, active.chatId);
        if (m.ok) setMessages(m.data);
      }
    }, 6000);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length, active?.key]);

  function open(c: Conversation) {
    setActive(c);
    setError(null);
    setMessages([]);
    setList((l) => l.map((x) => (x.key === c.key ? { ...x, unread: 0 } : x)));
    start(async () => {
      const r = await getConversationAction(c.projectId, c.chatId);
      if (r.ok) setMessages(r.data);
      else setError(r.error);
    });
  }

  if (!list.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
        <p className="text-4xl">💬</p>
        <p className="mt-3 font-semibold">Hali xabar yo&apos;q</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">Mijoz botga menyudan tashqari biror narsa yozsa, shu yerda paydo bo&apos;ladi. Sizga Telegram&apos;da ham keladi — o&apos;sha xabarga reply qilib javob berishingiz mumkin.</p>
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100dvh-220px)] min-h-[420px] overflow-hidden rounded-2xl border border-line bg-white md:grid-cols-[300px_1fr]">
      <ul className={`overflow-y-auto border-r border-line ${active ? "hidden md:block" : ""}`}>
        {list.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              onClick={() => open(c)}
              className={`flex w-full items-start gap-3 border-b border-line px-3 py-3 text-left hover:bg-surface ${active?.key === c.key ? "bg-surface" : ""}`}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 font-semibold text-brand-700">{c.name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="shrink-0 text-xs text-muted">{when(c.lastAt)}</span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-muted">
                    {c.lastDirection === "out" ? "Siz: " : ""}
                    {c.lastText}
                  </span>
                  {c.unread > 0 && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-500 text-[11px] font-bold text-white">{c.unread}</span>}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {active ? (
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <button type="button" onClick={() => setActive(null)} className="text-xl md:hidden" aria-label="Orqaga">
              ←
            </button>
            <div className="min-w-0">
              <p className="truncate font-semibold">{active.name}</p>
              <p className="truncate text-xs text-muted">
                {active.username ? `@${active.username} · ` : ""}bot: @{active.botUsername}
              </p>
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto bg-surface/60 px-4 py-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.direction === "out" ? "bg-brand-600 text-white" : "bg-white"}`}>
                  {m.text}
                  <span className={`mt-0.5 block text-right text-[10px] ${m.direction === "out" ? "text-white/70" : "text-muted"}`}>{when(m.created_at)}</span>
                </div>
              </div>
            ))}
            <div ref={bottom} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = text.trim();
              if (!t) return;
              start(async () => {
                setError(null);
                const r = await sendChatReplyAction(active.projectId, active.chatId, t);
                if (r.ok) {
                  setText("");
                  setMessages((m) => [...m, { id: Date.now(), direction: "out", text: t, created_at: new Date().toISOString() }]);
                } else setError(r.error);
              });
            }}
            className="flex gap-2 border-t border-line p-3"
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                }
              }}
              rows={1}
              placeholder="Javob yozing…"
              className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <button type="submit" disabled={pending || !text.trim()} className="rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              Yuborish
            </button>
          </form>
          {error && <p className="px-3 pb-2 text-sm text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="hidden place-items-center text-sm text-muted md:grid">Suhbatni tanlang</div>
      )}
    </div>
  );
}
