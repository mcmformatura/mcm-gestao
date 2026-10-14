-- Estoque: movimentações de copos e taças, estoque mínimo por modelo e estoque geral por produto
-- Mesmas regras de acesso das outras tabelas: só membros da equipe leem e alteram.

-- Entradas (compras recebidas) e saídas (usados, quebrados, separados) de copos e taças
create table if not exists public.estoque_movimentos (
  id text primary key,
  modelo text not null check (length(trim(modelo)) between 1 and 80),
  tipo text not null check (tipo in ('ENTRADA', 'SAIDA')),
  qtd integer not null check (qtd > 0),
  data date not null,
  obs text check (obs is null or length(obs) <= 140),
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid()
);
create index if not exists estoque_movimentos_modelo_idx on public.estoque_movimentos(modelo);

-- Estoque mínimo de cada modelo de copo (alerta abaixo disso)
create table if not exists public.copos_config (
  chave text primary key,
  nome text not null,
  minimo integer check (minimo is null or minimo >= 0),
  atualizado_em timestamptz not null default now()
);

-- Estoque geral: quantidade contada e reserva mínima de cada produto (inclui materiais fora dos pedidos)
create table if not exists public.estoque_geral (
  chave text primary key,
  produto text not null,
  categoria text not null default 'OUTROS'
    check (categoria in ('PAPELARIA','LEMBRANCAS','COPOS','DOCES','MONTAGEM','LOCACAO','OUTROS')),
  qtd integer check (qtd is null or qtd >= 0),
  minimo integer check (minimo is null or minimo >= 0),
  avulso boolean not null default false,
  atualizado_em timestamptz not null default now()
);

alter table public.estoque_movimentos enable row level security;
alter table public.copos_config enable row level security;
alter table public.estoque_geral enable row level security;

create policy membros_estoque_movimentos on public.estoque_movimentos for all to authenticated
  using ((select public.is_membro())) with check ((select public.is_membro()));
create policy membros_copos_config on public.copos_config for all to authenticated
  using ((select public.is_membro())) with check ((select public.is_membro()));
create policy membros_estoque_geral on public.estoque_geral for all to authenticated
  using ((select public.is_membro())) with check ((select public.is_membro()));
