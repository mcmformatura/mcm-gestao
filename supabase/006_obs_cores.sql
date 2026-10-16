-- Observação de cores dos guardanapos e das bolsas, por item (separada da observação geral)
alter table public.itens add column if not exists obs_cores text
  check (obs_cores is null or length(trim(obs_cores)) between 1 and 200);
