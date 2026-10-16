-- Bastão de LED: onde está o adesivo (vazio = ainda não informado)
alter table public.itens add column if not exists adesivo_status text
  check (adesivo_status is null or adesivo_status in ('PRODUCAO', 'LOJA'));
