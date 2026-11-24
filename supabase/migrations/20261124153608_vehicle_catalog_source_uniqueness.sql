-- Un modelo puede existir en ambos catálogos, pero no duplicarse en su origen.
-- Conserva exactamente la normalización de vehicles_brand_model_key.
begin;
create unique index vehicles_source_brand_model_key on public.vehicles
  (source, lower(regexp_replace(btrim(brand), '\s+', ' ', 'g')), lower(regexp_replace(btrim(model), '\s+', ' ', 'g')));
drop index public.vehicles_brand_model_key;
commit;
