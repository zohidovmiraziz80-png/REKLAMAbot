"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/logo";
import { signOut } from "../(auth)/actions";

/**
 * Qorong'i yon menyu: guruhlar (Savdo, Kanallar, AI, Sozlamalar), ochiladigan ichki bo'limlar.
 */

type Leaf = { label: string; href: string; soon?: boolean };
type Item = { label: string; icon: keyof typeof ICONS; href?: string; children?: Leaf[]; soon?: boolean; badge?: number };
type Group = { title?: string; items: Item[] };

const ICONS = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  builder: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  orders: "M3 4h2l2.4 11h10.2l2-8H6.2M9 20.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 20.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  catalog: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  customers: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  marketing: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 9l-6 6M9.5 9.5h.01M14.5 14.5h.01",
  metrics: "M4 4h16v16H4zM8 16v-4M12 16V8M16 16v-6",
  site: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
  telegram: "M21 4L3 11l6 2 2 6 3-4 5 4z",
  whatsapp: "M4 20l1.3-3.9A8 8 0 1 1 8 19.1z",
  chat: "M4 5h16v11H8l-4 4z",
  ai: "M5 5h14v10H9l-4 4zM9 9h.01M12 9h.01M15 9h.01",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1",
  payments: "M3 10h18M5 6h14l2 4v9H3v-9zM12 14h.01",
  staff: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6",
  app: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d={ICONS[name]} />
    </svg>
  );
}

function groups(newOrders: number): Group[] {
  return [
    {
      items: [
        { label: "Bosh sahifa", icon: "home", href: "/dashboard" },
        { label: "Konstruktor", icon: "builder", href: "/dashboard/sites" },
        {
          label: "Buyurtmalar",
          icon: "orders",
          badge: newOrders,
          children: [
            { label: "Barcha buyurtmalar", href: "/dashboard/orders" },
            { label: "Yangi", href: "/dashboard/orders?status=new" },
            { label: "Yetkazilmoqda", href: "/dashboard/orders?status=delivering" },
          ],
        },
        {
          label: "Katalog",
          icon: "catalog",
          children: [
            { label: "Mahsulotlar", href: "/dashboard/products" },
            { label: "Bito bilan sinxron", href: "/dashboard/integrations/bito" },
          ],
        },
        { label: "Mijozlar", icon: "customers", href: "/dashboard/customers" },
        { label: "Marketing", icon: "marketing", href: "/dashboard/marketing", soon: true },
        { label: "Metrikalar", icon: "metrics", href: "/dashboard/metrics", soon: true },
      ],
    },
    {
      title: "Kanallar",
      items: [
        { label: "Sayt", icon: "site", href: "/dashboard/sites" },
        { label: "Telegram bot", icon: "telegram", href: "/dashboard/bots" },
        { label: "WhatsApp", icon: "whatsapp", href: "/dashboard/whatsapp", soon: true },
        { label: "Chat", icon: "chat", href: "/dashboard/chat", soon: true },
      ],
    },
    {
      title: "AI",
      items: [
        { label: "SI konsultant", icon: "ai", href: "/dashboard/ai-consultant", soon: true },
        { label: "AI Telegram", icon: "telegram", href: "/dashboard/ai-telegram", soon: true },
      ],
    },
    {
      title: "Sozlamalar",
      items: [
        {
          label: "Sozlamalar",
          icon: "settings",
          children: [
            { label: "Do'kon sozlamalari", href: "/dashboard/orders/settings" },
            { label: "Integratsiyalar", href: "/dashboard/integrations" },
          ],
        },
        {
          label: "To'lovlar",
          icon: "payments",
          children: [
            { label: "Payme", href: "/dashboard/integrations/payme" },
            { label: "Click", href: "/dashboard/integrations/click" },
            { label: "Multicard", href: "/dashboard/integrations/multicard" },
            { label: "MIXBOT tarifi", href: "/dashboard/plan" },
          ],
        },
        { label: "Xodimlar", icon: "staff", href: "/dashboard/staff", soon: true },
        { label: "Dastur", icon: "app", href: "/dashboard/app", soon: true },
      ],
    },
  ];
}

function isActive(href: string, pathname: string, search: string) {
  const [path, query] = href.split("?");
  if (path === "/dashboard") return pathname === "/dashboard";
  if (query) return pathname === path && search.includes(query);
  if (path === "/dashboard/orders") return pathname === path && !search.includes("status=");
  if (path === "/dashboard/integrations") return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

const SoonBadge = () => <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">tez kunda</span>;

export function Sidebar({
  userName,
  workspaceName,
  planName,
  newOrders = 0,
  isAdmin = false,
}: {
  userName: string;
  workspaceName: string;
  planName?: string;
  newOrders?: number;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? "";
  const [open, setOpen] = useState(false);
  const data = groups(newOrders);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Joriy sahifa joylashgan bo'limni ochiq holda ko'rsatamiz
  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const g of data)
      for (const it of g.items)
        if (it.children?.some((c) => isActive(c.href, pathname, search))) next[`${g.title ?? ""}/${it.label}`] = true;
    setExpanded((e) => ({ ...e, ...next }));
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  const row = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition";
  const idle = "text-white/75 hover:bg-white/[0.06] hover:text-white";
  const active = "bg-white/[0.09] font-semibold text-white";

  return (
    <>
      {/* Mobil yuqori panel */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-[#0c0f14] px-4 py-3 text-white lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 font-extrabold">
          <LogoMark size={30} /> MIXBOT
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Menyu"
          className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium"
        >
          {open ? "Yopish" : "Menyu"}
        </button>
      </div>

      <aside className={`${open ? "block" : "hidden"} bg-[#0c0f14] text-white lg:sticky lg:top-0 lg:block lg:h-dvh lg:w-64 lg:shrink-0`}>
        <div className="flex h-full flex-col">
          <div className="hidden items-center gap-2.5 px-5 pt-5 pb-3 lg:flex">
            <LogoMark size={32} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-extrabold tracking-tight">{workspaceName}</p>
              <p className="text-[11px] text-white/45">MIXBOT</p>
            </div>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3 [scrollbar-width:thin]">
            {data.map((g) => (
              <div key={g.title ?? "main"} className="space-y-0.5">
                {g.title && <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-white/40 uppercase">{g.title}</p>}
                {g.items.map((it) => {
                  const key = `${g.title ?? ""}/${it.label}`;
                  if (it.children) {
                    const isOpen = !!expanded[key];
                    const childActive = it.children.some((c) => isActive(c.href, pathname, search));
                    return (
                      <div key={key}>
                        <button
                          type="button"
                          onClick={() => setExpanded((e) => ({ ...e, [key]: !isOpen }))}
                          aria-expanded={isOpen}
                          className={`${row} ${childActive && !isOpen ? active : idle}`}
                        >
                          <Icon name={it.icon} />
                          <span className="flex-1 text-left">{it.label}</span>
                          {!!it.badge && <span className="rounded-full bg-[#f7821b] px-1.5 text-[11px] font-bold text-white">{it.badge}</span>}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={`transition ${isOpen ? "rotate-180" : ""}`}>
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                        {isOpen && (
                          <div className="mt-0.5 ml-[22px] space-y-0.5 border-l border-white/10 pl-3">
                            {it.children.map((c) =>
                              c.soon ? (
                                <Link key={c.href} href={c.href} className="flex items-center justify-between rounded-md px-3 py-1.5 text-[13px] text-white/45 hover:text-white/70">
                                  {c.label} <SoonBadge />
                                </Link>
                              ) : (
                                <Link
                                  key={c.href}
                                  href={c.href}
                                  className={`block rounded-md px-3 py-1.5 text-[13px] ${isActive(c.href, pathname, search) ? "bg-white/[0.09] font-semibold text-white" : "text-white/65 hover:text-white"}`}
                                >
                                  {c.label}
                                </Link>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }
                  const on = it.href ? isActive(it.href, pathname, search) && !it.soon : false;
                  return (
                    <Link key={key} href={it.href ?? "#"} className={`${row} ${on ? active : it.soon ? "text-white/45 hover:bg-white/[0.04]" : idle}`}>
                      <Icon name={it.icon} />
                      <span className="flex-1">{it.label}</span>
                      {it.soon && <SoonBadge />}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="border-t border-white/10 p-3">
            {isAdmin && (
              <Link href="/admin" className="mb-2 flex items-center justify-between rounded-lg bg-white/[0.07] px-3 py-2 text-sm font-semibold hover:bg-white/[0.12]">
                Admin panel <span>→</span>
              </Link>
            )}
            <div className="flex items-center gap-3 px-1">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#2457b8] font-bold">{userName.trim().charAt(0).toUpperCase() || "?"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{userName}</p>
                <Link href="/dashboard/plan" className="text-xs text-white/50 hover:text-white/80">
                  {planName ?? "Tarif"}
                </Link>
              </div>
              <form action={signOut}>
                <button type="submit" title="Chiqish" aria-label="Chiqish" className="grid size-8 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
