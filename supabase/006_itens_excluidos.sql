-- Lixeira de itens: toda exclusão de item guarda uma cópia completa, para poder restaurar
create table if not exists public.itens_excluidos (
  id bigint generated always as identity primary key,
  item_id text not null,
  formando_id text,
  dados jsonb not null,
  excluido_em timestamptz not null default now(),
  excluido_por uuid default auth.uid()
);
create index if not exists itens_excluidos_formando_idx on public.itens_excluidos(formando_id);

alter table public.itens_excluidos enable row level security;
create policy membros_leem_excluidos on public.itens_excluidos for select to authenticated
  using ((select public.is_membro()));

create or replace function public.guardar_item_excluido()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.itens_excluidos (item_id, formando_id, dados) values (old.id, old.formando_id, to_jsonb(old));
  return old;
end;
$$;

drop trigger if exists itens_guardar_excluido on public.itens;
create trigger itens_guardar_excluido before delete on public.itens
  for each row execute function public.guardar_item_excluido();
