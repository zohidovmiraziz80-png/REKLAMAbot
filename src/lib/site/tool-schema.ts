/**
 * AI'ga beriladigan tool (JSON Schema). Zod sxemasi (schema.ts) bilan mos bo'lishi kerak —
 * AI javobi baribir zod orqali tekshirilib, tozalanadi.
 */

const str = (description: string) => ({ type: "string", description });

const block = (type: string, props: Record<string, unknown>, required: string[]) => ({
  type: "object",
  properties: { type: { const: type }, ...props },
  required: ["type", ...required],
});

const blocks = {
  type: "array",
  description: "Sahifa bloklari, yuqoridan pastga tartibda",
  items: {
    anyOf: [
      block(
        "hero",
        {
          heading: str("Asosiy sarlavha, qisqa va kuchli (max 80 belgi)"),
          subheading: str("1-2 jumlalik tavsif"),
          ctaText: str("Tugma matni"),
          ctaLink: str("Tugma havolasi: #aloqa, #mahsulotlar yoki /sahifa-slug"),
          align: { type: "string", enum: ["left", "center"] },
        },
        ["heading", "subheading", "ctaText", "ctaLink"],
      ),
      block(
        "features",
        {
          heading: str("Bo'lim sarlavhasi"),
          items: {
            type: "array",
            minItems: 3,
            maxItems: 6,
            items: {
              type: "object",
              properties: { icon: str("Bitta emoji"), title: str("Qisqa nom"), text: str("1 jumla") },
              required: ["icon", "title", "text"],
            },
          },
        },
        ["heading", "items"],
      ),
      block(
        "products",
        {
          heading: str("Bo'lim sarlavhasi"),
          subheading: str("Qisqa izoh yoki bo'sh"),
          items: {
            type: "array",
            minItems: 3,
            maxItems: 9,
            items: {
              type: "object",
              properties: {
                emoji: str("Mahsulotga mos bitta emoji"),
                name: str("Mahsulot/xizmat nomi"),
                price: str("Narx faqat foydalanuvchi bergan bo'lsa (masalan '120 000 so'm'), aks holda bo'sh qator"),
                description: str("1 jumla"),
                badge: str("Ixtiyoriy belgi: 'Yangi', 'Xit' yoki bo'sh"),
              },
              required: ["emoji", "name", "price", "description"],
            },
          },
        },
        ["heading", "items"],
      ),
      block("about", { heading: str("Sarlavha"), text: str("2-4 jumla") }, ["heading", "text"]),
      block(
        "faq",
        {
          heading: str("Sarlavha"),
          items: {
            type: "array",
            minItems: 3,
            maxItems: 6,
            items: { type: "object", properties: { q: str("Savol"), a: str("Javob") }, required: ["q", "a"] },
          },
        },
        ["heading", "items"],
      ),
      block(
        "cta",
        {
          heading: str("Chaqiriq sarlavhasi"),
          text: str("Qisqa matn"),
          buttonText: str("Tugma matni"),
          buttonLink: str("#aloqa yoki /sahifa-slug"),
        },
        ["heading", "buttonText", "buttonLink"],
      ),
      block(
        "contact",
        {
          heading: str("Sarlavha"),
          text: str("Qisqa taklif matni"),
          phone: str("Faqat foydalanuvchi bergan telefon, aks holda bo'sh"),
          telegram: str("Faqat foydalanuvchi bergan Telegram, aks holda bo'sh"),
          instagram: str("Faqat foydalanuvchi bergan Instagram, aks holda bo'sh"),
          address: str("Faqat foydalanuvchi bergan manzil, aks holda bo'sh"),
          workingHours: str("Faqat foydalanuvchi bergan ish vaqti, aks holda bo'sh"),
        },
        ["heading"],
      ),
    ],
  },
};

export const SITE_TOOL = {
  name: "build_site",
  description: "Biznes uchun tayyor sayt tuzilmasini qaytaradi",
  input_schema: {
    type: "object",
    properties: {
      name: str("Biznes nomi"),
      tagline: str("Qisqa shior"),
      language: { type: "string", enum: ["uz", "ru", "en"] },
      theme: {
        type: "object",
        properties: {
          primary: str("Asosiy rang, #RRGGBB, matn uchun yetarlicha to'q"),
          accent: str("Urg'u rangi (tugmalar), #RRGGBB"),
          font: { type: "string", enum: ["modern", "classic", "rounded"] },
          radius: { type: "string", enum: ["sharp", "soft", "round"] },
          mode: { type: "string", enum: ["light", "dark"] },
        },
        required: ["primary", "accent", "font", "radius", "mode"],
      },
      pages: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            slug: str("Lotin harflarida, birinchi sahifa uchun 'home'"),
            title: str("Menyudagi nom"),
            blocks,
          },
          required: ["slug", "title", "blocks"],
        },
      },
    },
    required: ["name", "tagline", "language", "theme", "pages"],
  },
} as const;
