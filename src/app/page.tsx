import Link from "next/link";
import { Logo } from "@/components/logo";

const FEATURES = [
  { title: "AI bilan sayt", text: "Biznesingizni yozing — AI sahifalar, matnlar va dizaynni tayyorlaydi. Keyin o'zingiz tahrirlaysiz." },
  { title: "Telegram bot", text: "Botingizni ulang: menyular, avtomatik javoblar va buyurtma qabul qilish." },
  { title: "Avtomatlashtirish", text: "Buyurtma keldi — xabar, mijoz bazaga, yetkazishga. Hammasi o'zi ishlaydi." },
  { title: "Savdo va CRM", text: "Mahsulotlar, buyurtmalar va mijozlar bir joyda. Bito va yetkazish xizmatlari bilan integratsiya." },
];

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo withSlogan />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-white">
            Kirish
          </Link>
          <Link href="/register" className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Boshlash
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-14 pb-20 sm:px-6 sm:pt-24">
        <section className="max-w-3xl">
          <p className="mb-4 inline-block rounded-full bg-accent-50 px-3 py-1 text-sm font-semibold text-accent-600">
            ⚡ Tezkor onlayn savdo
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Sayt, bot va savdoni bitta joydan boshqaring
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted text-pretty">
            Nima kerakligini oddiy so&apos;z bilan yozing — platforma sayt yaratadi, Telegram botni sozlaydi va
            buyurtmalarni avtomatlashtiradi.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-lg bg-accent-500 px-5 py-3 font-semibold text-white hover:bg-accent-600">
              Bepul boshlash
            </Link>
            <Link href="/login" className="rounded-lg border border-line bg-white px-5 py-3 font-semibold text-ink hover:border-brand-500">
              Akkauntga kirish
            </Link>
          </div>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-line bg-white p-5">
              <h2 className="font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
