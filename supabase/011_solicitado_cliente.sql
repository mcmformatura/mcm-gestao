-- Tags, bottons e aventais: se já foi solicitado ao cliente (vazio = ainda não informado)
alter table public.itens add column if not exists solicitado_status text
  check (solicitado_status is null or solicitado_status in ('SIM', 'NAO'));
