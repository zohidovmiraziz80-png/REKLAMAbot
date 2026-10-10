"use client";

import { createContext, useContext, useRef, type ElementType } from "react";

/**
 * Tahrirlovchida saytdagi matnni shu joyning o'zida bosib o'zgartirish.
 * Nashr qilingan saytda oddiy matn bo'lib chiqadi (kontekst yo'q).
 */

type EditApi = { onField: (blockId: string, path: string, value: string) => void };
const EditContext = createContext<EditApi | null>(null);
const ScopeContext = createContext<string | null>(null);

export function EditProvider({ onField, children }: EditApi & { children: React.ReactNode }) {
  return <EditContext.Provider value={{ onField }}>{children}</EditContext.Provider>;
}

export function BlockScope({ id, children }: { id: string; children: React.ReactNode }) {
  return <ScopeContext.Provider value={id}>{children}</ScopeContext.Provider>;
}

export function E({
  path,
  value,
  as,
  className,
  multiline = false,
  placeholder = "Matn kiriting",
}: {
  /** Blok ichidagi maydon yo'li, masalan "heading" yoki "items.0.title" */
  path: string;
  value: string;
  as?: ElementType;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const api = useContext(EditContext);
  const blockId = useContext(ScopeContext);
  const ref = useRef<HTMLElement>(null);
  const Tag = (as ?? "span") as ElementType;

  if (!api || !blockId) return <Tag className={className}>{value}</Tag>;

  return (
    <Tag
      ref={ref}
      className={`${className ?? ""} cursor-text rounded-sm outline-none hover:bg-[#2457b8]/10 focus:bg-white/80 focus:text-[#111827] focus:ring-2 focus:ring-[#f7821b] ${value ? "" : "opacity-50"}`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-placeholder={placeholder}
      onClick={(e: React.MouseEvent) => e.preventDefault()}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Escape") {
          e.currentTarget.innerText = value;
          e.currentTarget.blur();
        }
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onPaste={(e: React.ClipboardEvent<HTMLElement>) => {
        // Faqat oddiy matn joylansin
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        e.currentTarget.ownerDocument.execCommand("insertText", false, multiline ? text : text.replace(/\s*\n\s*/g, " "));
      }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        const next = e.currentTarget.innerText.replace(/ /g, " ").trim();
        if (!value && next === placeholder) return;
        if (next !== value) api.onField(blockId, path, next);
      }}
    >
      {value || placeholder}
    </Tag>
  );
}
