# MIXBOT

AI yordamida sayt, Telegram bot va avtomatlashtirish yaratadigan SaaS platforma.
Arxitektura va qoidalar: [CLAUDE.md](./CLAUDE.md).

**Sayt:** https://platforma-ebon.vercel.app

**Tariflar:** Bot, Sayt, Sayt + Bot. Yangi mijoz 14 kunlik "Sayt + Bot" sinov bilan boshlaydi; admin `/admin/workspaces` dan tarif/narxni boshqaradi (onlayn to'lov keyin). Bot saytni Telegram ichida Mini App sifatida ochadi.

**Integratsiyalar** — `/dashboard/integrations`. Bito: mijoz o'z API kalitini (username:secret) o'zi kiritadi (shifrlanadi); filial, narx turi, ombor, mas'ul xodim tanlanadi. Mahsulot/narx/qoldiq Bito'dan olinadi (qo'lda yoki sayt ochilganda har 3 soatda fonda), saytdagi buyurtmalar Bito'ga sotuv buyurtmasi bo'lib tushadi.

**5-bosqich (Do'kon: mahsulot, buyurtma, CRM)** — mahsulotlar (rasm, narx, chegirma, qoldiq, kategoriya), saytda va bot Mini App'ida katalog + savat + buyurtma, buyurtmalar paneli (holat, to'lov holati), mijozlar bazasi, do'kon sozlamalari (olib ketish/yetkazish, minimal buyurtma). Yangi buyurtma bot egasiga va ulangan Telegram guruhga tugmalar bilan keladi; mijoz "📦 Buyurtmalarim" va holat xabarlarini oladi. Keyingi: Bito, Payme/Click/Multicard, Yandex/BTS/Fargo, Eskiz SMS, AmoCRM/Bitrix24.

**4-bosqich (Telegram Bot Builder)** — BotFather tokeni bilan bot ulash (token shifrlanadi), menyu tugmalari va javoblar, ariza/buyurtma qabul qilish, egaga Telegram orqali xabar, arizalar ro'yxati.

**3-bosqich (Nashr qilish)** — sayt `/s/<nom>` manzilida internetga chiqadi; asosiy domen ulanganda `<nom>.<domen>` subdomeni; o'z domenini ulash (Vercel API) va `/admin/domains` admin paneli.

**2-bosqich (Website Builder)** — 6 ta tayyor shablondan sayt yaratish, vizual tahrirlovchi, ko'rib chiqish sahifasi. AI (yaratish va tahrirlash) kodi tayyor, lekin `AI_ENABLED=true` qo'yilmaguncha o'chiq.

**1-bosqich (Asos):** ro'yxatdan o'tish (telefon raqami bilan, email kod orqali tasdiqlanadi), login, parolni kod orqali tiklash, workspace, loyihalar dashboardi va amallar qatlami.

## Ishga tushirish

### 1. Supabase loyihasi
1. [supabase.com](https://supabase.com) → **New project**. Region sifatida eng yaqinini tanlang (masalan Frankfurt).
2. **Project Settings → API** bo'limidan `Project URL` va `anon public` kalitni nusxalang.

### 2. Bazani tayyorlash (migration)
1. Supabase'da **SQL Editor → New query** oching.
2. `supabase/migrations/` ichidagi fayllarni nomi bo'yicha tartib bilan (`..._foundation.sql` → `..._profile_phone.sql` → `..._websites.sql` → `..._publishing.sql` → `..._bots.sql` → `..._plans.sql` → `..._commerce.sql` → `..._integrations.sql`) joylab **Run** bosing.
3. **Table Editor**'da `profiles`, `workspaces`, `workspace_members`, `projects`, `audit_logs` jadvallari paydo bo'lganini tekshiring.

### 3. Auth sozlamalari
**Authentication → URL Configuration**:
- **Site URL:** Vercel manzilingiz, masalan `https://platforma.vercel.app`
- **Redirect URLs** ga qo'shing:
  - `https://platforma.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`

> Supabase'ning bepul email xizmati soatiga bir nechta xat bilan cheklangan. Sinov paytida xat kelmasa,
> **Authentication → Providers → Email** ichida "Confirm email" ni vaqtincha o'chirib qo'yish mumkin.

### 3.1 Email shablonlari (kod)
Supabase shablonlarni faqat **o'z SMTP** ulanganda tahrirlashga ruxsat beradi (Authentication → Emails → SMTP Settings).
SMTP ulangach, `supabase/email-templates/` ichidagi shablonlarni **Confirm sign up** va **Reset password** ga qo'ying — xatda 6 xonali kod (`{{ .Token }}`) va zaxira tugma bo'ladi.
SMTP ulanmaguncha standart xat (faqat havola) boradi; sayt ikkala usulni ham qabul qiladi.

### 4. Vercel
1. [vercel.com](https://vercel.com) → **Add New → Project** → shu GitHub repozitoriyni tanlang.
2. **Environment Variables** ga qo'shing:

| Nomi | Qiymati |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public kalit |
| `NEXT_PUBLIC_SITE_URL` | Vercel manzilingiz, masalan `https://platforma.vercel.app` |

3. **Deploy** bosing.

### 4.1 AI (ixtiyoriy, hozircha o'chiq)
Yoqish uchun Vercel'da `AI_ENABLED=true` qo'shing. Vercel'da AI Gateway OIDC orqali avtomatik ishlaydi (kalit kerak emas). Muqobil: `AI_GATEWAY_API_KEY` yoki `ANTHROPIC_API_KEY`. Model: `AI_MODEL` (standart `anthropic/claude-sonnet-5.5`). Har bir workspace uchun kuniga 30 ta AI so'rovi.

### 4.2 Nashr qilish va domenlar
- **Hozir:** saytlar `https://<platforma>/s/<nom>` manzilida ochiladi — qo'shimcha sozlash kerak emas.
- **Subdomenlar** (`gulzor.tezdokon.uz`): domen sotib oling, Vercel → Domains'da `tezdokon.uz` va `*.tezdokon.uz` ni qo'shing (wildcard uchun domen nameserver'lari Vercel'da bo'lishi kerak), keyin `NEXT_PUBLIC_ROOT_DOMAIN=tezdokon.uz`.
- **O'z domeni:** `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` qo'shilgach, foydalanuvchilar "Nashr qilish" oynasidan domen ulaydi va DNS yozuvlarini ko'radi.
- **Admin:** `insert into public.platform_admins (user_id) values ('<auth.users id>');` → `/admin/domains`.

### 4.3 Telegram botlar
- `BOT_TOKEN_KEY` (32 bayt base64) Vercel'da maxfiy o'zgaruvchi sifatida turishi kerak — usiz bot ulab bo'lmaydi.
- Webhook: `https://<platforma>/api/telegram/<projectId>`, `X-Telegram-Bot-Api-Secret-Token` bilan tekshiriladi.
- Server `SUPABASE_SERVICE_ROLE_KEY` dan foydalanadi (Vercel–Supabase integratsiyasi avtomatik qo'shgan).

### 5. Kompyuterda ishga tushirish (ixtiyoriy)
```bash
npm install
cp .env.example .env.local   # qiymatlarni to'ldiring
npm run dev                  # http://localhost:3000
```

## Tekshiruv ro'yxati
- [ ] `/register` — akkaunt yaratiladi (yoki email tasdiqlash xati keladi)
- [ ] `/login` — kirish ishlaydi, `/dashboard` ochiladi
- [ ] Loyiha yaratish, nomini o'zgartirish, o'chirish ishlaydi
- [ ] Chiqib qayta kirganda loyihalar saqlanib qolgan
- [ ] `/forgot-password` — tiklash xati keladi, havola yangi parol sahifasini ochadi
- [ ] Telefonda menyu ochiladi va sahifalar to'g'ri ko'rinadi

## Tuzilma
```
src/
  actions/            amallar qatlami (UI va AI shu yerdan chaqiradi)
    define.ts         defineAction, kontekst va natija turlari
    run.ts            runAction: sessiya → workspace → rol → tasdiq → validatsiya
    registry.ts       barcha amallar reyestri (AI Assistant uchun)
    projects.ts       createProject, listProjects, renameProject, deleteProject
  app/
    (auth)/           login, register, forgot-password, reset-password
    auth/callback/    email havolalari uchun
    dashboard/        boshqaruv paneli
  lib/supabase/       server, brauzer va middleware klientlari
supabase/migrations/  baza o'zgarishlari
```
