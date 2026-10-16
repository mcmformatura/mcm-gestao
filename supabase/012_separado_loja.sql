-- Guardanapos: se já estão separados em loja (vazio = ainda não informado)
alter table public.itens add column if not exists separado_status text
  check (separado_status is null or separado_status in ('SIM', 'NAO'));
