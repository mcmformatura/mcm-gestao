-- Tempo real: o site recebe um aviso quando eventos, formandos, itens, pagamentos ou observações mudam
-- (pela planilha do Google ou por outra pessoa) e atualiza a tela sozinho. Os avisos seguem as mesmas
-- regras de acesso (RLS): só membros da equipe recebem.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
alter publication supabase_realtime add table public.eventos, public.formandos, public.itens, public.pagamentos, public.obs_categorias;
