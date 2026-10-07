-- Papel de cada membro: 'admin' gerencia a equipe; 'membro' só usa o painel.
alter table public.membros add column if not exists papel text not null default 'membro' check (papel in ('admin', 'membro'));

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membros m
    where m.email = lower(coalesce(auth.jwt() ->> 'email', '')) and m.papel = 'admin'
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Administradores gerenciam a equipe (incluir, mudar papel, remover)
create policy admins_incluem on public.membros for insert to authenticated with check ((select public.is_admin()));
create policy admins_alteram on public.membros for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admins_removem on public.membros for delete to authenticated using ((select public.is_admin()));

-- Todos os usuários de login existentes (em 07/10/2026) viram administradores
insert into public.membros (email, papel)
select lower(u.email), 'admin' from auth.users u where u.email is not null
on conflict (email) do update set papel = 'admin';
