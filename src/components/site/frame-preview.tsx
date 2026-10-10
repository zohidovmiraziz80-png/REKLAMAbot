"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Saytni alohida iframe ichida ko'rsatadi — telefon/planshet kengligida haqiqiy moslashuvchan ko'rinish
 * (Tailwind breakpoint'lari iframe kengligiga qarab ishlaydi). Uslublar asosiy sahifadan nusxalanadi.
 */
export function FramePreview({
  width,
  children,
  onBody,
}: {
  width: number | "100%";
  children: React.ReactNode;
  /** iframe body tayyor bo'lganda (blokka aylantirish uchun) */
  onBody?: (body: HTMLElement | null) => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const setup = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;
      doc.open();
      doc.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"></body></html>');
      doc.close();
      const copy = () => {
        doc.head.querySelectorAll("[data-copied]").forEach((n) => n.remove());
        document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((n) => {
          const c = n.cloneNode(true) as HTMLElement;
          c.setAttribute("data-copied", "1");
          doc.head.appendChild(c);
        });
      };
      copy();
      // Next.js keyinroq uslub qo'shsa ham nusxalaymiz
      const obs = new MutationObserver(copy);
      obs.observe(document.head, { childList: true });
      setBody(doc.body);
      onBody?.(doc.body);
      return () => obs.disconnect();
    };
    const cleanup = setup();
    return () => {
      cleanup?.();
      onBody?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <iframe
      ref={ref}
      title="Sayt ko'rinishi"
      className="mx-auto block h-full border-0 bg-white transition-[width] duration-300"
      style={{ width: width === "100%" ? "100%" : `${width}px`, maxWidth: "100%" }}
    >
      {body && createPortal(children, body)}
    </iframe>
  );
}
