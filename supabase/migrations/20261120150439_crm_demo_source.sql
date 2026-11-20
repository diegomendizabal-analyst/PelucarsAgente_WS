-- Distingue las pruebas manuales del futuro ingreso de WhatsApp. No carga datos.
begin;
alter table public.leads drop constraint leads_source_check;
alter table public.leads add constraint leads_source_check check (source in ('whatsapp_bot','demo'));
comment on column public.leads.source is 'whatsapp_bot: ingreso de la integración; demo: datos ficticios cargados explícitamente para pruebas.';
commit;
