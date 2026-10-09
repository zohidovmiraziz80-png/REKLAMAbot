# TezDo'kon: loyiha konteksti (Claude Code uchun)

Bu fayl repozitoriyning ildizida turadi. Claude Code har safar shu faylni o'qiydi va butun loyiha bo'yicha bir xil qoidalarga amal qiladi.

## Platforma nima

TezDo'kon (shiori: "Tezkor onlayn savdo") — SaaS platforma. Foydalanuvchilar AI yordamida quyidagilarni yaratadi va boshqaradi:
- veb-saytlar,
- Telegram botlar,
- avtomatlashtirishlar,
- mahsulotlar, buyurtmalar va mijozlar (CRM).

Asosiy bozor: O'zbekiston. Interfeys tili o'zbek tili (lotin yozuvi), keyinroq rus tili qo'shiladi.

## Asosiy qarorlar

1. **Sayt yaratish.** AI saytni yaratadi, keyin foydalanuvchi uni vizual tahrirlaydi.
   - AI HTML yozmaydi. U bloklardan iborat JSON tuzilma qaytaradi.
   - JSON zod sxemasi bilan tekshiriladi va faqat ruxsat etilgan komponentlar orqali render qilinadi.
2. **Telegram bot.** Foydalanuvchi BotFather'dan olgan tokenini ulaydi.
   - Token bazada shifrlangan holda saqlanadi.
   - Webhook Next.js API route orqali ishlaydi.
3. **AI butun platformani boshqaradi.** Har bir funksiya `src/actions/` ichida alohida "amal" sifatida yoziladi.
   - Interfeys tugmalari ham, AI Assistant ham aynan shu amallarni chaqiradi.

## Texnologiyalar

| Vazifa | Texnologiya |
|---|---|
| Frontend va backend | Next.js (App Router) + TypeScript + Tailwind |
| Baza, auth, fayllar | Supabase (Postgres, RLS majburiy) |
| AI | Claude API (Anthropic SDK) |
| Hosting | Vercel |
| Validatsiya | zod |

## Amallar qatlami (eng muhim qoida)

Har bir amal quyidagi shaklda yoziladi:

```ts
export const createProject = defineAction({
  name: "createProject",
  description: "Yangi loyiha (sayt, bot yoki avtomatlashtirish) yaratadi",
  input: z.object({ name: z.string().min(1), type: z.enum(["website", "bot", "automation"]) }),
  handler: async (ctx, input) => { /* ctx.user, ctx.workspaceId, ctx.supabase */ },
});
```

Amallar uchun qoidalar:
- Amal har doim foydalanuvchi va workspace huquqini tekshiradi.
- Barcha amallar bitta reyestrda ro'yxatga olinadi. AI Assistant shu reyestrdan tool ro'yxatini avtomatik oladi.
- Pul, o'chirish yoki tashqi xizmatga yuborish bilan bog'liq amallar `requiresConfirmation: true` bilan belgilanadi. AI bunday amalni bajarishdan oldin foydalanuvchidan tasdiq so'raydi.

## Modullar va bosqichlar

1. **Asos.** Auth, workspace, Dashboard, amallar qatlami.
2. **AI Website Builder.** Blok tizimi, AI generatsiya, vizual tahrirlovchi, preview.
3. **Publishing.**
   - Subdomen (`<nom>.<platforma-domeni>`) avtomatik beriladi.
   - Foydalanuvchi o'z domenini Vercel Domains API orqali ulaydi: DNS yozuvlari ko'rsatiladi, tekshiruvdan o'tadi, SSL avtomatik yoqiladi.
   - Admin panelda barcha domenlar va ularning holati ko'rinadi. Qaysi tarifda o'z domenini ulash mumkinligi ham shu yerda belgilanadi.
4. **Telegram Bot Builder.** Token ulash, menyular, javoblar, buyurtma qabul qilish.
5. **Products & Orders + CRM + integratsiyalar.**
   - **Bito integratsiyasi** (API kalit orqali):
     - mahsulot va qoldiqlar Bito'dan sinxronlanadi;
     - buyurtma Bito'ga savdo buyurtmasi sifatida yuboriladi;
     - mijozlar telefon raqami bo'yicha bog'lanadi;
     - holat o'zgarganda mijozga Telegram orqali xabar boradi.
   - **Yetkazish.** Umumiy adapter interfeysi orqali ishlaydi:
     ```ts
     interface DeliveryProvider {
       calculatePrice(input): Promise<Quote>;
       createShipment(order): Promise<Shipment>;
       getStatus(shipmentId): Promise<ShipmentStatus>;
       cancelShipment(shipmentId): Promise<void>;
     }
     ```
     - Adapterlar: Yandex Delivery (birinchi), BTS, Fargo. BTS va Fargo API hujjatlari keyinroq olinadi.
     - O'z kuryeri uchun alohida sozlama bor: hudud bo'yicha narx va muddat.
     - Foydalanuvchi hudud bo'yicha qaysi xizmat ishlashini belgilaydi.
6. **Automation Builder.** Trigger → shart → amal zanjiri. Amallar shu amallar qatlamidan olinadi.
7. **AI Assistant.** Matnli buyruqlar orqali barcha amallarni chaqiradi.
8. **Billing, Notifications, Analytics, Admin Panel, Security.**

## Xavfsizlik qoidalari

- Barcha jadvallarda RLS yoqilgan bo'ladi. Ma'lumotlar `workspace_id` bo'yicha ajratiladi.
- Maxfiy ma'lumotlar (bot tokenlari, Bito va yetkazish API kalitlari) bazada shifrlangan holda saqlanadi. Ular hech qachon frontendga yuborilmaydi va logga yozilmaydi.
- Barcha kiritilgan ma'lumotlar zod bilan tekshiriladi.
- Telegram webhook va tashqi webhooklar maxfiy kalit (secret) bilan tekshiriladi.
- Muhim amallar `audit_logs` jadvaliga yoziladi.

## Ish tartibi

- Har bir o'zgarishdan keyin `npm run build` va `npm run lint` xatosiz o'tishi kerak.
- Bazadagi har bir o'zgarish `supabase/migrations/` papkasida migration fayl sifatida yoziladi.
- Yangi muhit o'zgaruvchisi qo'shilsa, `.env.example` fayliga ham yoziladi.
- Interfeys mobil qurilmaga mos bo'lishi kerak.
