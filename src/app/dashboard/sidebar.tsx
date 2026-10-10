"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { signOut } from "../(auth)/actions";
import { NAV_ITEMS } from "./nav";

export function Sidebar({ userName, workspaceName, isAdmin = false }: { userName: string; workspaceName: string; isAdmin?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [{ href: "/dashboard", label: "Bosh sahifa", soon: false }].concat(
    NAV_ITEMS.map((i) => ({ href: `/dashboard/${i.slug}`, label: i.label, soon: !!i.soon })),
  );

  return (
    <>
      {/* Mobil yuqori panel */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white px-4 py-3 lg:hidden">
        <Logo href="/dashboard" />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Menyu"
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium"
        >
          {open ? "Yopish" : "Menyu"}
        </button>
      </div>

      <aside
        className={`${open ? "block" : "hidden"} border-b border-line bg-white lg:sticky lg:top-0 lg:block lg:h-dvh lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0`}
      >
        <div className="flex h-full flex-col p-4">
          <div className="hidden px-2 pt-1 pb-5 lg:block">
            <Logo href="/dashboard" />
          </div>
          <p className="truncate px-2 pb-3 text-xs font-medium tracking-wide text-muted uppercase">{workspaceName}</p>

          <nav className="flex-1 space-y-0.5">
            {links.map((l) => {
              const active = l.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-[15px] transition ${
                    active ? "bg-brand-50 font-semibold text-brand-700" : "text-ink hover:bg-surface"
                  }`}
                >
                  {l.label}
                  {l.soon && <span className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-muted">tez kunda</span>}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-line pt-4">
            {isAdmin && (
              <Link href="/admin" className="mb-2 flex items-center justify-between rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white">
                Admin panel <span>→</span>
              </Link>
            )}
            <p className="truncate px-3 text-sm font-medium">{userName}</p>
            <form action={signOut}>
              <button type="submit" className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-surface hover:text-ink">
                Chiqish
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
