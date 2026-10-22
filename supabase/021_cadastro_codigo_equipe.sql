-- Cadastro sem administrador: quem cria a conta e digita o código da equipe entra direto como 'membro'.
-- O banco guarda só o resumo (sha256) do código. Para trocar o código:
--   update public.codigo_equipe set codigo_hash = encode(extensions.digest(upper('NOVO-CODIGO'), 'sha256'), 'hex'), atualizado_em = now();
create table if not exists public.codigo_equipe (
  id int primary key default 1 check (id = 1),
  codigo_hash text not null,
  atualizado_em timestamptz not null default now()
);
alter table public.codigo_equipe enable row level security;   -- sem política: ninguém lê pela API

-- Tentativas erradas, para barrar quem tenta adivinhar o código (5 por hora por conta)
create table if not exists public.tentativas_codigo (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  quando timestamptz not null default now()
);
create index if not exists tentativas_codigo_user_idx on public.tentativas_codigo(user_id, quando desc);
alter table public.tentativas_codigo enable row level security;

create or replace function public.entrar_na_equipe(p_codigo text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_uid is null or v_email = '' then raise exception 'faça login primeiro'; end if;
  if exists (select 1 from public.membros where email = v_email) then return true; end if;
  if (select count(*) from public.tentativas_codigo where user_id = v_uid and quando > now() - interval '1 hour') >= 5 then
    raise exception 'muitas tentativas com código errado; espere uma hora';
  end if;
  if not exists (select 1 from public.codigo_equipe
                 where codigo_hash = encode(extensions.digest(upper(trim(coalesce(p_codigo, ''))), 'sha256'), 'hex')) then
    insert into public.tentativas_codigo (user_id) values (v_uid);
    return false;
  end if;
  insert into public.membros (email, papel) values (v_email, 'membro') on conflict (email) do nothing;
  return true;
end;
$$;
revoke all on function public.entrar_na_equipe(text) from public, anon;
grant execute on function public.entrar_na_equipe(text) to authenticated;
