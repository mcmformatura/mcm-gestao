-- Integração com as planilhas do Google: cada aba (pelo código interno dela, que não muda quando a aba é
-- renomeada) fica ligada a um cliente. A função receber-planilha usa estas tabelas.

-- Planilhas conhecidas e a turma padrão para abas novas
create table if not exists public.planilhas (
  id text primary key,
  titulo text,
  evento_padrao_id text references public.eventos(id) on delete set null,
  atualizado_em timestamptz not null default now()
);

-- Aba -> cliente. bloco = qual orçamento dentro da aba (0 = o primeiro); ignorar = aba que não vira pedido
create table if not exists public.planilha_abas (
  planilha_id text not null,
  aba_gid bigint not null,
  bloco int not null default 0,
  aba_titulo text,
  formando_id text references public.formandos(id) on delete set null,
  ignorar boolean not null default false,
  atualizado_em timestamptz not null default now(),
  primary key (planilha_id, aba_gid, bloco)
);
create index if not exists planilha_abas_formando_idx on public.planilha_abas(formando_id);

-- Registro de cada envio vindo das planilhas
create table if not exists public.planilha_sync_log (
  id bigint generated always as identity primary key,
  planilha_id text,
  aba_titulo text,
  formando_id text,
  quando timestamptz not null default now(),
  resultado jsonb,
  erro text
);
create index if not exists planilha_sync_log_formando_idx on public.planilha_sync_log(formando_id, quando desc);

-- Senha da integração (guardada só o resumo sha256)
create table if not exists public.integracao_tokens (
  token_hash text primary key,
  nome text,
  criado_em timestamptz not null default now()
);

-- Pagamentos: de onde vieram (planilha = substituídos a cada envio; nulo = lançados no site)
alter table public.pagamentos add column if not exists origem text check (origem is null or origem in ('planilha'));
update public.pagamentos set origem = 'planilha' where criado_por is null and origem is null;

alter table public.planilhas enable row level security;
alter table public.planilha_abas enable row level security;
alter table public.planilha_sync_log enable row level security;
alter table public.integracao_tokens enable row level security;
create policy membros_leem_planilhas on public.planilhas for select to authenticated using ((select public.is_membro()));
create policy membros_leem_planilha_abas on public.planilha_abas for select to authenticated using ((select public.is_membro()));
create policy membros_leem_sync_log on public.planilha_sync_log for select to authenticated using ((select public.is_membro()));
-- integracao_tokens: sem política = ninguém lê pela API (só a função, com a chave de serviço)

-- Aplica de uma vez (tudo ou nada) as mudanças calculadas pela função para um cliente
create or replace function public.aplicar_sync_planilha(p_formando text, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  x jsonb;
  n_upd int := 0; n_ins int := 0; n_del int := 0; n_pag int := 0;
  v_lix bigint; v_dados jsonb;
begin
  if not exists (select 1 from public.formandos where id = p_formando) then
    raise exception 'cliente % não existe', p_formando;
  end if;

  for x in select * from jsonb_array_elements(coalesce(p->'remover', '[]'::jsonb)) loop
    delete from public.itens where id = x #>> '{}' and formando_id = p_formando and pedido_id is null;
    n_del := n_del + 1;
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p->'atualizar', '[]'::jsonb)) loop
    update public.itens set
      ordem = (x->>'ordem')::int, produto = x->>'produto', qtd = (x->>'qtd')::numeric,
      valor_unit = (x->>'valor_unit')::numeric, valor_total = (x->>'valor_total')::numeric,
      categoria = x->>'categoria', brinde = (x->>'brinde')::boolean, obs = nullif(x->>'obs', ''),
      atualizado_em = now()
    where id = x->>'id' and formando_id = p_formando and pedido_id is null;
    n_upd := n_upd + 1;
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p->'inserir', '[]'::jsonb)) loop
    -- Linha recortada e colada mais abaixo chega como "removida" num envio e "nova" no seguinte:
    -- se a própria integração tirou um item igual nos últimos 3 dias, ele volta com status, fornecedor, prazo etc.
    select e.id, e.dados into v_lix, v_dados from public.itens_excluidos e
     where e.formando_id = p_formando and e.excluido_por is null and e.excluido_em > now() - interval '3 days'
       and lower(trim(e.dados->>'produto')) = lower(trim(x->>'produto'))
       and not exists (select 1 from public.itens i where i.id = e.item_id)
     order by e.excluido_em desc limit 1;
    if v_lix is not null then
      insert into public.itens select * from jsonb_populate_record(null::public.itens, v_dados);
      update public.itens set
        ordem = (x->>'ordem')::int, produto = x->>'produto', qtd = (x->>'qtd')::numeric,
        valor_unit = (x->>'valor_unit')::numeric, valor_total = (x->>'valor_total')::numeric,
        brinde = (x->>'brinde')::boolean, atualizado_em = now()
      where id = v_dados->>'id';
      delete from public.itens_excluidos where id = v_lix;
      v_lix := null;
      n_ins := n_ins + 1;
      continue;
    end if;
    insert into public.itens (id, formando_id, ordem, produto, fornecedor_id, qtd, valor_unit, valor_total, categoria, brinde, obs, atualizado_em)
    values (x->>'id', p_formando, (x->>'ordem')::int, x->>'produto', (select f.id from public.fornecedores f where f.nome = x->>'fornecedor'),
            (x->>'qtd')::numeric, (x->>'valor_unit')::numeric, (x->>'valor_total')::numeric, x->>'categoria', (x->>'brinde')::boolean, nullif(x->>'obs', ''), now());
    n_ins := n_ins + 1;
  end loop;

  if p ? 'pagamentos' then
    delete from public.pagamentos where formando_id = p_formando and origem = 'planilha';
    for x in select * from jsonb_array_elements(p->'pagamentos') loop
      insert into public.pagamentos (formando_id, ordem, tipo, descricao, valor, data, status, obs, origem)
      values (p_formando, (x->>'ordem')::int, x->>'tipo', x->>'descricao', (x->>'valor')::numeric, nullif(x->>'data', ''), x->>'status', nullif(x->>'obs', ''), 'planilha');
      n_pag := n_pag + 1;
    end loop;
  end if;

  return jsonb_build_object('alterados', n_upd, 'novos', n_ins, 'removidos', n_del, 'pagamentos', n_pag);
end;
$$;
revoke execute on function public.aplicar_sync_planilha(text, jsonb) from public, anon, authenticated;
