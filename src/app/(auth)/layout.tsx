import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-8">
        <Logo withSlogan />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">{children}</div>
    </main>
  );
}
