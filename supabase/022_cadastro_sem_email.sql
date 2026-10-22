-- Cadastro pelo servidor (função cadastrar-equipe): com o código da equipe certo a conta já nasce
-- confirmada, sem e-mail de confirmação. Esta tabela barra quem tenta adivinhar o código
-- (10 tentativas erradas por hora por endereço de internet). Sem política: só a função usa.
create table if not exists public.tentativas_cadastro (
  id bigint generated always as identity primary key,
  ip text not null,
  quando timestamptz not null default now()
);
create index if not exists tentativas_cadastro_ip_idx on public.tentativas_cadastro(ip, quando desc);
alter table public.tentativas_cadastro enable row level security;
