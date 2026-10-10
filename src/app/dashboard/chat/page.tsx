import type { Metadata } from "next";
import { runAction } from "@/actions/run";
import { listConversations } from "@/actions/chat";
import { ChatView } from "./chat-view";

export const metadata: Metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const r = await runAction(listConversations, {});
  const data = r.ok ? r.data : { ready: false, conversations: [] };
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Chat</h1>
      <p className="mt-1 mb-5 text-muted">Mijozlar botga yozgan xabarlar. Javobingiz bot orqali mijozga boradi.</p>
      {!data.ready ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Chat uchun bazani yangilash kerak: Vercel → Supabase → Query oynasida tayyor SQL&apos;ni ishga tushiring (Read-only → Disable → Run).
        </p>
      ) : (
        <ChatView initial={data.conversations} />
      )}
    </div>
  );
}
