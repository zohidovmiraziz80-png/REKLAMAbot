import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mobil ilova" };

export default function AppPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">📱 MIXBOT telefoningizda</h1>
        <p className="mt-1 text-muted">MIXBOT&apos;ni ilova kabi o&apos;rnating — bosh ekrandan bir bosishda ochiladi, buyurtma va chat doim qo&apos;l ostida.</p>
      </div>
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Android (Chrome)</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>Telefonda Chrome orqali MIXBOT&apos;ga kiring.</li>
          <li>Pastda chiqqan «MIXBOT ilovasi → O&apos;rnatish» tugmasini bosing yoki ⋮ menyu → «Ilovani o&apos;rnatish».</li>
        </ol>
      </section>
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">iPhone (Safari)</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>Safari orqali MIXBOT&apos;ga kiring.</li>
          <li>Pastdagi «Ulashish» ⎋ tugmasi → «Bosh ekranga qo&apos;shish» (На экран «Домой»).</li>
        </ol>
      </section>
      <section className="rounded-2xl border border-line bg-white p-5 text-sm text-muted">
        Yangi buyurtma va mijoz xabarlari bildirishnoma sifatida Telegram botingiz orqali keladi — bot egasi sifatida ulangan bo&apos;lsangiz.
      </section>
    </div>
  );
}
