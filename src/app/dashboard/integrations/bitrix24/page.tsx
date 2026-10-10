import type { Metadata } from "next";
import { CrmPage } from "../_crm/crm-page";

export const metadata: Metadata = { title: "Bitrix24" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <CrmPage provider="bitrix24" />;
}
