-- Noor (shahar ichida tezkor yetkazish) integratsiyasi
alter table public.integrations drop constraint if exists integrations_provider_check;
alter table public.integrations add constraint integrations_provider_check
  check (provider in ('bito', 'payme', 'click', 'multicard', 'yandex', 'bts', 'fargo', 'noor', 'eskiz', 'amocrm', 'bitrix24'));
