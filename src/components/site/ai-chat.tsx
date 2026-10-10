"use client";

import { useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

/** Saytdagi AI konsultant: o'ng pastki burchakdagi chat oynasi */
export function AiChat({ slug, raised }: { slug: string; raised?: boolean }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([{ role: "assistant", content: "Assalomu alaykum! Qanday mahsulot qidiryapsiz? Savolingizni yozing 🙂" }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turns.length, open]);

  async function send() {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...turns, { role: "user" as const, content: q }];
    setTurns(next);
    setText("");
    setBusy(true);
    try {
      const r = await fetch(`/api/shop/${slug}/ai`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Birinchi salomlashuvni yubormaymiz
        body: JSON.stringify({ messages: next.slice(1).slice(-10) }),
      });
      const d = (await r.json()) as { ok?: boolean; answer?: string; error?: string };
      setTurns((t) => [...t, { role: "assistant", content: d.ok && d.answer ? d.answer : (d.error ?? "Javob berib bo'lmadi") }]);
    } catch {
      setTurns((t) => [...t, { role: "assistant", content: "Internet aloqasini tekshiring." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Konsultant"
          className={`fixed right-3 z-40 grid size-14 place-items-center rounded-full bg-[color:var(--s-accent)] text-2xl text-white shadow-xl transition-[bottom] ${raised ? "bottom-20" : "bottom-4"}`}
        >
          💬
        </button>
      )}
      {open && (
        <div className="fixed inset-x-2 bottom-2 z-50 flex h-[70dvh] max-h-[560px] flex-col overflow-hidden rounded-[var(--s-radius)] border border-[color:var(--s-line)] bg-[color:var(--s-bg)] text-[color:var(--s-text)] shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[380px]">
          <div className="flex items-center justify-between bg-[color:var(--s-accent)] px-4 py-3 text-white">
            <div>
              <p className="font-semibold">Konsultant</p>
              <p className="text-xs opacity-80">Odatda bir necha soniyada javob beradi</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Yopish" className="text-2xl leading-none">
              ×
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {turns.map((t, i) => (
              <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${t.role === "user" ? "bg-[color:var(--s-accent)] text-white" : "bg-[color:var(--s-surface)]"}`}
                >
                  {t.content}
                </div>
              </div>
            ))}
            {busy && <div className="w-fit rounded-2xl bg-[color:var(--s-surface)] px-3 py-2 text-sm text-[color:var(--s-muted)]">yozmoqda…</div>}
            <div ref={end} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2 border-t border-[color:var(--s-line)] p-2"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              placeholder="Savolingiz…"
              className="min-w-0 flex-1 rounded-[calc(var(--s-radius)*0.6)] border border-[color:var(--s-line)] bg-transparent px-3 py-2 text-sm outline-none"
            />
            <button type="submit" disabled={busy || !text.trim()} className="rounded-[calc(var(--s-radius)*0.6)] bg-[color:var(--s-accent)] px-4 text-sm font-semibold text-white disabled:opacity-50">
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}
