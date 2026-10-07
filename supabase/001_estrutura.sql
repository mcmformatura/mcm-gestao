-- MCM Gestão: estrutura do banco e regras de acesso
-- Só e-mails cadastrados em public.membros enxergam e alteram os dados.

create table if not exists public.membros (
  email text primary key check (email = lower(email)),
  nome text,
  criado_em timestamptz not null default now()
);

create or replace function public.is_membro()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membros m
    where m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_membro() from public, anon;
grant execute on function public.is_membro() to authenticated;

create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  criado_em timestamptz not null default now()
);

create table if not exists public.eventos (
  id text primary key,
  nome text not null,
  data date,
  slug text not null unique,
  ordem int not null default 100,
  criado_por_pedido boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists public.formandos (
  id text primary key,
  evento_id text not null references public.eventos(id) on delete cascade,
  nome text not null,
  criado_em timestamptz not null default now()
);
create index if not exists formandos_evento_idx on public.formandos(evento_id);

create table if not exists public.pedidos (
  id text primary key,
  formando_id text not null references public.formandos(id) on delete cascade,
  formando_novo boolean not null default false,
  total numeric(12,2) not null default 0,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid()
);
create index if not exists pedidos_formando_idx on public.pedidos(formando_id);

create table if not exists public.itens (
  id text primary key,
  formando_id text not null references public.formandos(id) on delete cascade,
  pedido_id text references public.pedidos(id) on delete cascade,
  ordem int not null default 0,
  produto text not null,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  qtd numeric(12,2) not null default 0,
  valor_unit numeric(12,2),
  valor_total numeric(12,2),
  categoria text not null default 'OUTROS'
    check (categoria in ('PAPELARIA','LEMBRANCAS','COPOS','DOCES','MONTAGEM','LOCACAO','OUTROS')),
  brinde boolean not null default false,
  obs text,
  status text not null default 'AGUARDANDO_PRODUCAO'
    check (status in ('AGUARDANDO_PRODUCAO','REPASSADO','EM_PRODUCAO','PRONTO','ENTREGUE')),
  pedido_em date,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create index if not exists itens_formando_idx on public.itens(formando_id);
create index if not exists itens_pedido_idx on public.itens(pedido_id);
create index if not exists itens_fornecedor_idx on public.itens(fornecedor_id);

create table if not exists public.pagamentos (
  id bigint generated always as identity primary key,
  formando_id text not null references public.formandos(id) on delete cascade,
  ordem int not null default 0,
  descricao text,
  valor numeric(12,2) not null,
  data text,
  status text not null default 'PAGO' check (status in ('PAGO','A_PAGAR')),
  tipo text not null default 'PARCELA' check (tipo in ('PARCELA','DESCONTO')),
  obs text
);
create index if not exists pagamentos_formando_idx on public.pagamentos(formando_id);

create table if not exists public.custos (
  chave text primary key,
  produto text not null,
  custo numeric(12,2) check (custo >= 0),
  venda numeric(12,2) check (venda >= 0),
  atualizado_em timestamptz not null default now()
);

-- Regras de acesso (RLS): só membros
alter table public.membros enable row level security;
alter table public.fornecedores enable row level security;
alter table public.eventos enable row level security;
alter table public.formandos enable row level security;
alter table public.pedidos enable row level security;
alter table public.itens enable row level security;
alter table public.pagamentos enable row level security;
alter table public.custos enable row level security;

create policy membros_leem on public.membros for select to authenticated using ((select public.is_membro()));
create policy membros_fornecedores on public.fornecedores for all to authenticated using ((select public.is_membro())) with check ((select public.is_membro()));
create policy membros_eventos on public.eventos for all to authenticated using ((select public.is_membro())) with check ((select public.is_membro()));
create policy membros_formandos on public.formandos for all to authenticated using ((select public.is_membro())) with check ((select public.is_membro()));
create policy membros_pedidos on public.pedidos for all to authenticated using ((select public.is_membro())) with check ((select public.is_membro()));
create policy membros_itens on public.itens for all to authenticated using ((select public.is_membro())) with check ((select public.is_membro()));
create policy membros_pagamentos on public.pagamentos for all to authenticated using ((select public.is_membro())) with check ((select public.is_membro()));
create policy membros_custos on public.custos for all to authenticated using ((select public.is_membro())) with check ((select public.is_membro()));

-- Lançar um pedido novo (cria evento e formando quando preciso) numa única transação
create or replace function public.criar_pedido(p jsonb)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  v_ev text := nullif(p -> 'evento' ->> 'id', '');
  v_fo text := nullif(p -> 'formando' ->> 'id', '');
  v_pid text := 'p' || replace(gen_random_uuid()::text, '-', '');
  v_novo boolean := false;
  v_base int;
  v_total numeric := 0;
  it jsonb;
  k int := 0;
begin
  if not public.is_membro() then raise exception 'sem permissão' using errcode = '42501'; end if;
  if jsonb_array_length(coalesce(p -> 'itens', '[]'::jsonb)) = 0 then raise exception 'pedido sem itens'; end if;

  if v_ev is null then
    if coalesce(trim(p -> 'evento' ->> 'nome'), '') = '' then raise exception 'evento sem nome'; end if;
    v_ev := 'ev_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    insert into public.eventos (id, nome, data, slug, ordem, criado_por_pedido)
    values (v_ev, trim(p -> 'evento' ->> 'nome'), nullif(p -> 'evento' ->> 'data', '')::date, v_ev, 100, true);
  elsif not exists (select 1 from public.eventos where id = v_ev) then
    raise exception 'evento não encontrado';
  end if;

  if v_fo is null then
    if coalesce(trim(p -> 'formando' ->> 'nome'), '') = '' then raise exception 'formando sem nome'; end if;
    v_fo := 'fo_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    v_novo := true;
    insert into public.formandos (id, evento_id, nome) values (v_fo, v_ev, trim(p -> 'formando' ->> 'nome'));
  elsif not exists (select 1 from public.formandos where id = v_fo) then
    raise exception 'formando não encontrado';
  end if;

  insert into public.pedidos (id, formando_id, formando_novo) values (v_pid, v_fo, v_novo);
  select coalesce(max(ordem), 0) into v_base from public.itens where formando_id = v_fo;

  for it in select value from jsonb_array_elements(p -> 'itens') loop
    k := k + 1;
    insert into public.itens (id, formando_id, pedido_id, ordem, produto, fornecedor_id, qtd, valor_unit, valor_total, categoria, obs, atualizado_por)
    values (
      v_pid || '_' || k, v_fo, v_pid, v_base + k, trim(it ->> 'produto'),
      nullif(it ->> 'fornId', '')::uuid, (it ->> 'qtd')::numeric,
      nullif(it ->> 'vu', '')::numeric, nullif(it ->> 'vt', '')::numeric,
      coalesce(nullif(it ->> 'cat', ''), 'OUTROS'), nullif(trim(it ->> 'obs'), ''), auth.uid()
    );
    v_total := v_total + coalesce(nullif(it ->> 'vt', '')::numeric, 0);
  end loop;

  update public.pedidos set total = v_total where id = v_pid;
  return v_pid;
end;
$$;

-- Excluir um pedido lançado pelo painel (e o formando/evento que ele criou, se ficarem vazios)
create or replace function public.excluir_pedido(pid text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_fo text; v_novo boolean; v_ev text;
begin
  if not public.is_membro() then raise exception 'sem permissão' using errcode = '42501'; end if;
  select formando_id, formando_novo into v_fo, v_novo from public.pedidos where id = pid;
  if v_fo is null then raise exception 'pedido não encontrado'; end if;
  select evento_id into v_ev from public.formandos where id = v_fo;
  delete from public.pedidos where id = pid;
  if v_novo and not exists (select 1 from public.itens where formando_id = v_fo) and not exists (select 1 from public.pagamentos where formando_id = v_fo) then
    delete from public.formandos where id = v_fo;
  end if;
  delete from public.eventos e where e.id = v_ev and e.criado_por_pedido and not exists (select 1 from public.formandos f where f.evento_id = e.id);
end;
$$;

revoke all on function public.criar_pedido(jsonb) from public, anon;
revoke all on function public.excluir_pedido(text) from public, anon;
grant execute on function public.criar_pedido(jsonb) to authenticated;
grant execute on function public.excluir_pedido(text) to authenticated;
