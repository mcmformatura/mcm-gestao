-- Observação final de cada categoria (papelaria, lembranças, copos…) na ficha de cada cliente
create table if not exists public.obs_categorias (
  formando_id text not null references public.formandos (id) on delete cascade,
  categoria text not null check (categoria in ('PAPELARIA', 'LEMBRANCAS', 'COPOS', 'DOCES', 'MONTAGEM', 'LOCACAO', 'OUTROS')),
  obs text not null check (length(trim(obs)) between 1 and 1000),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  primary key (formando_id, categoria)
);
alter table public.obs_categorias enable row level security;
drop policy if exists membros_obs_categorias on public.obs_categorias;
create policy membros_obs_categorias on public.obs_categorias for all to authenticated
  using ((select public.is_membro())) with check ((select public.is_membro()));
