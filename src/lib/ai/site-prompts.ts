import type { Site } from "@/lib/site/schema";

export type SiteBrief = {
  businessName: string;
  description: string;
  style: "modern" | "classic" | "bright" | "minimal";
  language: "uz" | "ru" | "en";
  phone?: string;
  telegram?: string;
  instagram?: string;
  address?: string;
};

const LANGUAGE_RULE: Record<SiteBrief["language"], string> = {
  uz: "Barcha matnlar o'zbek tilida, LOTIN yozuvida bo'lsin (o', g', sh, ch harflari bilan, apostrof sifatida ' belgisi).",
  ru: "Все тексты на русском языке.",
  en: "All copy in English.",
};

const STYLE_HINT: Record<SiteBrief["style"], string> = {
  modern: "zamonaviy: toza, ko'p bo'sh joy, font 'modern', radius 'soft'",
  classic: "klassik: jiddiy va ishonchli, font 'classic', radius 'sharp', to'q ranglar",
  bright: "yorqin: quvnoq va energiyali, font 'rounded', radius 'round', to'yingan urg'u rangi",
  minimal: "minimal: oddiy, kam rang, font 'modern', radius 'sharp'",
};

export const SITE_SYSTEM_PROMPT = `Siz O'zbekistondagi kichik bizneslar uchun sotuvchi landing sahifalar yaratadigan tajribali dizayner va kopirayterisiz.
Natijani FAQAT build_site tool orqali qaytarasiz.

Qoidalar:
- Matnlar aniq, qisqa, mijozga foyda haqida. Umumiy "sifatli xizmat" kabi bo'sh gaplardan qoching — biznes tavsifidagi aniq narsalarga tayaning.
- HECH QACHON telefon, manzil, Telegram, Instagram, narx, statistika yoki mijoz fikrlarini o'ylab topmang. Foydalanuvchi bermagan ma'lumot o'rnida bo'sh qator ("") qoldiring.
- "testimonials" blokini ishlatmang (soxta sharhlar bo'lmasligi uchun).
- Mahsulotlar: tavsifdan kelib chiqib 3-9 ta namunaviy pozitsiya; narx faqat foydalanuvchi aytgan bo'lsa.
- Odatiy tuzilma: hero → features → products → about → faq → cta → contact. Kerak bo'lsa 1-3 qo'shimcha sahifa (masalan "mahsulotlar", "aloqa"), lekin oddiy biznes uchun bitta sahifa yetarli.
- Tugma havolalari: "#aloqa" (aloqa bloki), "#mahsulotlar" yoki "/sahifa-slug".
- Ranglar: primary — to'q, matn va sarlavhalar uchun o'qiladigan; accent — tugmalar uchun yorqinroq. Ikkalasi #RRGGBB.
- Emoji faqat ikonka maydonlarida, matn ichida emas.`;

export function buildGenerateMessage(brief: SiteBrief) {
  const contacts = [
    brief.phone && `Telefon: ${brief.phone}`,
    brief.telegram && `Telegram: ${brief.telegram}`,
    brief.instagram && `Instagram: ${brief.instagram}`,
    brief.address && `Manzil: ${brief.address}`,
  ].filter(Boolean);

  return `Yangi sayt yarating.

Biznes nomi: ${brief.businessName}
Biznes haqida (foydalanuvchi yozgan):
"""
${brief.description}
"""
Uslub: ${STYLE_HINT[brief.style]}
Til: ${LANGUAGE_RULE[brief.language]} (language maydoni: "${brief.language}")
Aloqa ma'lumotlari: ${contacts.length ? contacts.join("; ") : "berilmagan — contact blokidagi maydonlarni bo'sh qoldiring"}`;
}

/** Tahrirlash uchun id'larsiz ixcham JSON */
function stripIds(site: Site) {
  return {
    ...site,
    pages: site.pages.map((p) => ({
      ...p,
      blocks: p.blocks.map((b) => {
        const { id, ...rest } = b;
        void id;
        return rest;
      }),
    })),
  };
}

export function buildEditMessage(site: Site, instruction: string) {
  return `Mavjud sayt (JSON):
${JSON.stringify(stripIds(site))}

Foydalanuvchi so'rovi:
"""
${instruction}
"""

So'rovni bajaring va TO'LIQ yangilangan saytni build_site orqali qaytaring.
So'ralmagan qismlarni o'zgartirmang. Saytdagi mavjud telefon, narx va boshqa ma'lumotlarni saqlang; yangi aloqa ma'lumoti yoki narxni faqat foydalanuvchi so'rovda bergan bo'lsa qo'shing.
Mavjud "testimonials" blokini o'zgartirmasdan qoldiring, yangisini qo'shmang.`;
}
