-- Pagamentos: para quem foi pago (conta / pessoa que recebeu) e registro de quem lançou
alter table public.pagamentos add column if not exists recebedor text
  check (recebedor is null or length(trim(recebedor)) between 1 and 80);
alter table public.pagamentos add column if not exists criado_em timestamptz not null default now();
alter table public.pagamentos add column if not exists criado_por uuid default auth.uid();
alter table public.pagamentos add constraint pagamentos_valor_positivo check (valor > 0) not valid;
