import type { Metadata } from "next";
import { CrmPage } from "../_crm/crm-page";

export const metadata: Metadata = { title: "AmoCRM" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <CrmPage provider="amocrm" />;
}
