# TezDo'kon

AI yordamida sayt, Telegram bot va avtomatlashtirish yaratadigan SaaS platforma.
Arxitektura va qoidalar: [CLAUDE.md](./CLAUDE.md).

**Sayt:** https://platforma-ebon.vercel.app

**Holat:** 2-bosqich (AI Website Builder) — AI sayt yaratadi, vizual tahrirlovchi, AI bilan tahrirlash, ko'rib chiqish sahifasi.

**1-bosqich (Asos):** ro'yxatdan o'tish (telefon raqami bilan, email kod orqali tasdiqlanadi), login, parolni kod orqali tiklash, workspace, loyihalar dashboardi va amallar qatlami.

## Ishga tushirish

### 1. Supabase loyihasi
1. [supabase.com](https://supabase.com) → **New project**. Region sifatida eng yaqinini tanlang (masalan Frankfurt).
2. **Project Settings → API** bo'limidan `Project URL` va `anon public` kalitni nusxalang.

### 2. Bazani tayyorlash (migration)
1. Supabase'da **SQL Editor → New query** oching.
2. `supabase/migrations/` ichidagi fayllarni nomi bo'yicha tartib bilan (`..._foundation.sql` → `..._profile_phone.sql` → `..._websites.sql`) joylab **Run** bosing.
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

### 4.1 AI
Vercel'da AI Gateway OIDC orqali avtomatik ishlaydi (kalit kerak emas). Muqobil: `AI_GATEWAY_API_KEY` yoki `ANTHROPIC_API_KEY`. Model: `AI_MODEL` (standart `anthropic/claude-sonnet-5.5`). Har bir workspace uchun kuniga 30 ta AI so'rovi.

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
