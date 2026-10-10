import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { formatUzPhone } from "@/lib/phone";
import { ORDER_STATUS_LABELS, formatDateTime, formatMoney, type OrderStatus } from "@/lib/shop/format";

export const metadata: Metadata = { title: "Bosh sahifa" };

const STATUS_STYLE: Record<OrderStatus, string> = {
  new: "bg-accent-50 text-accent-600",
  confirmed: "bg-brand-50 text-brand-700",
  delivering: "bg-sky-50 text-sky-700",
  done: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ws = user ? await getActiveWorkspace(supabase, user.id) : null;
  if (!user || !ws) return null;

  // Bugun (Toshkent vaqti bilan) boshlangan payt
  const now = new Date(Date.now() + 5 * 3600_000);
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 5 * 3600_000).toISOString();

  const [today, recent, newCount, customers, sites, published, products, bots, bito] = await Promise.all([
    supabase.from("orders").select("total, status").eq("workspace_id", ws.id).gte("created_at", todayStart).limit(2000),
    supabase
      .from("orders")
      .select("id, number, customer_name, phone, status, total, created_at")
      .eq("workspace_id", ws.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).eq("status", "new"),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).eq("type", "website"),
    supabase.from("published_sites").select("slug").eq("workspace_id", ws.id).limit(1),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).eq("is_active", true),
    supabase.from("bots").select("username").eq("workspace_id", ws.id).limit(1),
    supabase.from("integrations").select("provider").eq("workspace_id", ws.id).eq("provider", "bito").maybeSingle(),
  ]);

  const todayOrders = (today.data ?? []).filter((o) => o.status !== "cancelled");
  const todaySum = todayOrders.reduce((s, o) => s + Number(o.total), 0);
  const firstName = ((user.user_metadata?.full_name as string | undefined) ?? "").split(" ")[0];

  const steps = [
    { done: (sites.count ?? 0) > 0, label: "Sayt yaratish", href: "/dashboard/sites", cta: "Yaratish" },
    { done: (products.count ?? 0) > 0, label: "Mahsulot qo'shish", href: "/dashboard/products", cta: "Qo'shish" },
    { done: (published.data ?? []).length > 0, label: "Saytni nashr qilish", href: "/dashboard/sites", cta: "Nashr qilish" },
    { done: (bots.data ?? []).length > 0, label: "Telegram bot ulash", href: "/dashboard/bots", cta: "Ulash" },
    { done: !!bito.data, label: "Bito ulash (ixtiyoriy)", href: "/dashboard/integrations/bito", cta: "Ulash" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  const card = "rounded-2xl border border-line bg-white";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Xayrli kun{firstName ? `, ${firstName}` : ""}</h1>
          <p className="mt-1 text-muted">Bugun do&apos;koningizda nima bo&apos;lyapti</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {published.data?.[0] && (
            <a
              href={`/s/${published.data[0].slug}`}
              target="_blank"
              rel="noopener"
              className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-brand-500"
            >
              Saytni ochish ↗
            </a>
          )}
          <Link href="/dashboard/products" className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600">
            + Mahsulot qo&apos;shish
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={`${card} p-4`}>
          <p className="text-sm text-muted">Bugungi buyurtmalar</p>
          <p className="mt-1 text-2xl font-bold">{todayOrders.length}</p>
        </div>
        <div className={`${card} p-4`}>
          <p className="text-sm text-muted">Bugungi savdo</p>
          <p className="mt-1 text-2xl font-bold">{formatMoney(todaySum)}</p>
        </div>
        <Link href="/dashboard/orders?status=new" className="rounded-2xl bg-brand-700 p-4 text-white transition hover:bg-brand-600">
          <p className="text-sm text-white/70">Yangi, ko&apos;rilmagan</p>
          <p className="mt-1 text-2xl font-bold text-accent-400">{newCount.count ?? 0}</p>
        </Link>
        <Link href="/dashboard/customers" className={`${card} p-4 transition hover:border-brand-500`}>
          <p className="text-sm text-muted">Mijozlar</p>
          <p className="mt-1 text-2xl font-bold">{customers.count ?? 0}</p>
        </Link>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        <section className={card}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-semibold">Oxirgi buyurtmalar</h2>
            <Link href="/dashboard/orders" className="text-sm font-medium text-brand-600 hover:underline">
              Hammasi →
            </Link>
          </div>
          {recent.data?.length ? (
            <ul className="divide-y divide-line">
              {recent.data.map((o) => (
                <li key={o.id}>
                  <Link href="/dashboard/orders" className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface/60">
                    <span className="w-14 font-semibold">№{o.number}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {o.customer_name ?? "—"} · <span className="text-muted">{formatUzPhone(o.phone as string)}</span>
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[o.status as OrderStatus]}`}>
                      {ORDER_STATUS_LABELS[o.status as OrderStatus]}
                    </span>
                    <span className="w-28 text-right font-semibold">{formatMoney(o.total as number)}</span>
                    <span className="hidden w-32 text-right text-xs text-muted sm:block">{formatDateTime(o.created_at as string)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted">Hali buyurtma yo&apos;q. Saytni nashr qilib, bot ulasangiz buyurtmalar shu yerda chiqadi.</p>
          )}
        </section>

        <section className={`${card} p-5`}>
          <h2 className="font-semibold">Do&apos;konni ishga tushirish</h2>
          <p className="mt-1 text-sm text-muted">
            {doneCount} / {steps.length} bajarildi
          </p>
          <div className="mt-3 h-1.5 rounded-full bg-surface">
            <div className="h-1.5 rounded-full bg-accent-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-3">
                {s.done ? (
                  <span className="grid size-5 place-items-center rounded-full bg-emerald-600 text-xs text-white">✓</span>
                ) : (
                  <span className="size-5 rounded-full border-2 border-line" />
                )}
                <span className={`flex-1 ${s.done ? "text-muted line-through" : ""}`}>{s.label}</span>
                {!s.done && (
                  <Link href={s.href} className="font-semibold text-accent-600 hover:underline">
                    {s.cta}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
