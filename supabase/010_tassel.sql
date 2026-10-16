-- Menu provençal: se já está com o tassel (vazio = ainda não informado)
alter table public.itens add column if not exists tassel_status text
  check (tassel_status is null or tassel_status in ('COM', 'SEM'));
