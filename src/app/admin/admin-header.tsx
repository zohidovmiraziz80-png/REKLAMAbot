import Link from "next/link";
import { Logo } from "@/components/logo";

export function AdminHeader({ active }: { active: "workspaces" | "domains" }) {
  const link = (href: string, key: typeof active, label: string) => (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active === key ? "bg-ink text-white" : "text-muted hover:bg-surface"}`}
    >
      {label}
    </Link>
  );
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Logo href="/dashboard" />
        <nav className="flex items-center gap-1">
          {link("/admin/workspaces", "workspaces", "Mijozlar va tariflar")}
          {link("/admin/domains", "domains", "Domenlar")}
        </nav>
      </div>
    </header>
  );
}
