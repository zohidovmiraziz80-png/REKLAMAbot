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
  { slug: "products", label: "Mahsulotlar" },
  { slug: "orders", label: "Buyurtmalar" },
  { slug: "customers", label: "Mijozlar" },
  { slug: "integrations", label: "Integratsiyalar" },
  { slug: "plan", label: "Tarif" },
  { slug: "whatsapp", label: "WhatsApp", soon: true, description: "WhatsApp orqali buyurtma qabul qilish va mijozlarga xabar yuborish." },
  { slug: "ai-consultant", label: "SI konsultant", soon: true, description: "Saytda mijozlarga mahsulot tanlashda yordam beradigan sun'iy intellekt." },
  { slug: "ai-telegram", label: "AI Telegram", soon: true, description: "Telegram botda mijoz savollariga sun'iy intellekt javob beradi." },
  { slug: "payments", label: "To'lovlar", soon: true, description: "Payme, Click va Multicard orqali onlayn to'lov." },
  { slug: "app", label: "Dastur", soon: true, description: "Do'konni telefondan boshqarish uchun mobil ilova." },
];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  website: "Sayt",
  bot: "Telegram bot",
  automation: "Avtomatlashtirish",
};
