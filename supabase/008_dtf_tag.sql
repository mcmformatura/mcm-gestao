-- Onde está o DTF dos copos e a tag dos guardanapos (vazio = ainda não informado)
alter table public.itens add column if not exists dtf_status text
  check (dtf_status is null or dtf_status in ('PRODUCAO', 'LOJA'));
alter table public.itens add column if not exists tag_status text
  check (tag_status is null or tag_status in ('PRODUCAO', 'LOJA', 'COSTUREIRA'));
