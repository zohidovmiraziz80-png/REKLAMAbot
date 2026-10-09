import Link from "next/link";

/** TezDo'kon belgisi: savat + chaqmoq + tezlik chiziqlari */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="TezDo'kon"
      className={className}
    >
      <defs>
        <linearGradient id="tz-bolt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFC531" />
          <stop offset="1" stopColor="#F7821B" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="#0F2D6B" />
      {/* tezlik chiziqlari */}
      <path d="M5 19h6M3 24h7M5 29h5" stroke="#F7941D" strokeWidth="2.4" strokeLinecap="round" />
      {/* savat */}
      <path
        d="M12 13h4.2l3.6 17.2a2 2 0 0 0 2 1.6h13.6a2 2 0 0 0 1.9-1.4L40.6 19H18"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22.5" cy="37.5" r="2.6" fill="#FFFFFF" />
      <circle cx="34.5" cy="37.5" r="2.6" fill="#FFFFFF" />
      {/* chaqmoq */}
      <path d="M30.8 14.5 24.6 25.4h4.6l-2 8.1 7.2-11.4h-4.8l2.6-7.6z" fill="url(#tz-bolt)" />
    </svg>
  );
}

export function Logo({ href = "/", withSlogan = false }: { href?: string; withSlogan?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="TezDo'kon — bosh sahifa">
      <LogoMark size={withSlogan ? 44 : 36} />
      <span className="flex flex-col leading-none">
        <span className="text-xl font-extrabold tracking-tight">
          <span className="text-brand-700">Tez</span>
          <span className="text-accent-500">Do&apos;kon</span>
        </span>
        {withSlogan && (
          <span className="mt-1 text-[11px] font-semibold tracking-wide text-muted uppercase">Tezkor onlayn savdo</span>
        )}
      </span>
    </Link>
  );
}
