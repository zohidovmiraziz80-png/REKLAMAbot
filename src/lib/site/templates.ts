import { siteSchema, type Block, type Site } from "./schema";

/**
 * Tayyor shablonlar — AI'siz sayt yaratish uchun.
 * Foydalanuvchi biznes nomi va aloqa ma'lumotlarini kiritadi, qolganini tahrirlovchida o'zgartiradi.
 * Narx, telefon va boshqa ma'lumotlar o'ylab topilmaydi — bo'sh qoldiriladi.
 */

export type TemplateDetails = {
  businessName: string;
  phone?: string;
  telegram?: string;
  instagram?: string;
  address?: string;
};

export type TemplateId = "market";

type TemplateDef = {
  id: TemplateId;
  title: string;
  description: string;
  emoji: string;
  theme: Site["theme"];
  build: (d: TemplateDetails) => Block[];
};

let counter = 0;
const bid = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

function contact(d: TemplateDetails, heading = "Biz bilan bog'laning", text = "Savollaringiz bo'lsa, yozing yoki qo'ng'iroq qiling."): Block {
  return {
    type: "contact",
    id: bid(),
    heading,
    text,
    phone: d.phone ?? "",
    telegram: d.telegram ?? "",
    instagram: d.instagram ?? "",
    address: d.address ?? "",
    workingHours: "",
  };
}

const TEMPLATES: TemplateDef[] = [
  {
    id: "market",
    title: "Marketpleys",
    description: "Katta qidiruv, savat, promo banner va zich mahsulot katalogi",
    emoji: "🛒",
    theme: { primary: "#0f2d6b", accent: "#f7821b", font: "modern", radius: "soft", mode: "light" },
    build: (d) => [
      {
        type: "hero",
        variant: "promo",
        id: bid(),
        heading: `${d.businessName} — hammasi bir joyda`,
        subheading: "Minglab mahsulotlar, qulay narxlar va tez yetkazib berish.",
        ctaText: "Xarid qilish",
        ctaLink: "#katalog",
        align: "left",
      },
      {
        type: "features",
        variant: "strip",
        id: bid(),
        heading: "",
        items: [
          { icon: "🚚", title: "Tez yetkazish", text: "Buyurtma tez yetib boradi" },
          { icon: "🛡️", title: "Sifat kafolati", text: "Har bir mahsulot tekshiriladi" },
          { icon: "💳", title: "Qulay to'lov", text: "Naqd, karta, Click yoki Payme" },
        ],
      },
      {
        type: "shop",
        id: bid(),
        heading: "Barcha mahsulotlar",
        subheading: "",
        card: "market",
        columns: "5",
        mobileColumns: "2",
        ratio: "portrait",
        showSearch: true,
        showDescription: false,
      },
      contact(d, "Aloqa", "Savollaringiz bo'lsa, yozing yoki qo'ng'iroq qiling."),
    ],
  },
];

export const TEMPLATE_LIST = TEMPLATES.map(({ id, title, description, emoji, theme }) => ({ id, title, description, emoji, theme }));

export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id) as [TemplateId, ...TemplateId[]];

export function buildFromTemplate(id: TemplateId, details: TemplateDetails): Site {
  const tpl = TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
  return siteSchema.parse({
    name: details.businessName,
    tagline: "",
    language: "uz",
    theme: tpl.theme,
    header: { logo: "", showNav: true, ctaText: "", ctaLink: "", variant: "market" },
    footer: { variant: "columns", text: "" },
    pages: [{ slug: "home", title: "Bosh sahifa", blocks: tpl.build(details) }],
  });
}
