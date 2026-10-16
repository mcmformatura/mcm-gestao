-- DTF das bolsas e necessaires Letícia também pode estar com o costureiro
alter table public.itens drop constraint if exists itens_dtf_status_check;
alter table public.itens add constraint itens_dtf_status_check
  check (dtf_status is null or dtf_status in ('PRODUCAO', 'LOJA', 'COSTUREIRO'));
