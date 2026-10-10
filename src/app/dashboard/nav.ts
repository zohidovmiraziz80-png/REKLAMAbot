import type { ProjectType } from "@/actions/project-types";

export type NavItem = {
  slug: string;
  label: string;
  /** Loyiha turi bo'yicha filtrlangan ro'yxat ko'rsatiladi */
  projectType?: ProjectType;
  /** Hali qurilmagan bo'lim */
  soon?: boolean;
  description?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { slug: "sites", label: "Saytlar", projectType: "website" },
  { slug: "bots", label: "Botlar", projectType: "bot" },
  { slug: "automations", label: "Avtomatlashtirish", projectType: "automation" },
  { slug: "products", label: "Mahsulotlar", soon: true, description: "Mahsulotlar, narxlar va qoldiqlar. Bito bilan sinxronlash." },
  { slug: "orders", label: "Buyurtmalar", soon: true, description: "Sayt va botdan kelgan buyurtmalar, yetkazish holati." },
  { slug: "customers", label: "Mijozlar", soon: true, description: "Mijozlar bazasi va xaridlar tarixi (CRM)." },
  { slug: "integrations", label: "Integratsiyalar", soon: true, description: "Bito, Yandex Delivery, BTS, Fargo va to'lov tizimlari." },
  { slug: "plan", label: "Tarif" },
  { slug: "settings", label: "Sozlamalar", soon: true, description: "Profil, workspace, jamoa a'zolari va tarif." },
];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  website: "Sayt",
  bot: "Telegram bot",
  automation: "Avtomatlashtirish",
};
