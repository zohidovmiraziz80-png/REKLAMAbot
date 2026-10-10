-- 4-tarif: Biznes (Sayt + Bot + integratsiyalar). Tarif imkoniyatlari kodda (src/lib/plans.ts) belgilanadi.
insert into public.plans (id, name, description, price_uzs, allow_sites, allow_bots, sort)
values ('business', 'Biznes', 'Sayt + Bot va barcha integratsiyalar', null, true, true, 4)
on conflict (id) do nothing;

update public.plans set name = 'Bot', description = 'Telegram bot do''kon: sayt faqat bot ichida (Mini App) ochiladi', allow_sites = true, allow_bots = true where id = 'bot';
update public.plans set description = 'Internet do''kon sayti; bot faqat mijozni tasdiqlash va xabarlar uchun', allow_bots = true where id = 'site';
update public.plans set description = 'Sayt va bot birga — to''liq internet do''kon' where id = 'site_bot';
