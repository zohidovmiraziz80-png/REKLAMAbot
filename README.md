# Platforma

AI yordamida sayt, Telegram bot va avtomatlashtirish yaratadigan SaaS platforma.
Arxitektura va qoidalar: [CLAUDE.md](./CLAUDE.md).

**Sayt:** https://platforma-ebon.vercel.app

**Hozirgi holat — 1-bosqich (Asos):** ro'yxatdan o'tish, login, parolni tiklash, workspace, loyihalar dashboardi va amallar qatlami.

## Ishga tushirish

### 1. Supabase loyihasi
1. [supabase.com](https://supabase.com) → **New project**. Region sifatida eng yaqinini tanlang (masalan Frankfurt).
2. **Project Settings → API** bo'limidan `Project URL` va `anon public` kalitni nusxalang.

### 2. Bazani tayyorlash (migration)
1. Supabase'da **SQL Editor → New query** oching.
2. `supabase/migrations/20261009000000_foundation.sql` faylining butun matnini joylang va **Run** bosing.
3. **Table Editor**'da `profiles`, `workspaces`, `workspace_members`, `projects`, `audit_logs` jadvallari paydo bo'lganini tekshiring.

### 3. Auth sozlamalari
**Authentication → URL Configuration**:
- **Site URL:** Vercel manzilingiz, masalan `https://platforma.vercel.app`
- **Redirect URLs** ga qo'shing:
  - `https://platforma.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`

> Supabase'ning bepul email xizmati soatiga bir nechta xat bilan cheklangan. Sinov paytida xat kelmasa,
> **Authentication → Providers → Email** ichida "Confirm email" ni vaqtincha o'chirib qo'yish mumkin.

### 4. Vercel
1. [vercel.com](https://vercel.com) → **Add New → Project** → shu GitHub repozitoriyni tanlang.
2. **Environment Variables** ga qo'shing:

| Nomi | Qiymati |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public kalit |
| `NEXT_PUBLIC_SITE_URL` | Vercel manzilingiz, masalan `https://platforma.vercel.app` |

3. **Deploy** bosing.

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
