-- Planilha desligada (ativa = false): o script do Google pode até enviar, mas nada entra no site.
-- Usado para as planilhas antigas de 2025 que o script encontra no Drive.
alter table public.planilhas add column if not exists ativa boolean not null default true;
insert into public.planilhas (id, titulo, ativa, atualizado_em) values
  ('1FXcF11pO9JwbvkfSN1tW6UCqNHF23OSQlUWrc67usyE', 'Abril 2025', false, '2025-01-01'),
  ('1dITCxsuTOML2WP4rk9VoVO8HUTR6zpxaNVJ8GMZJLYc', 'Março 2025', false, '2025-01-01'),
  ('1a9F7bxylxbWoyfPIuHcqUzeVunqQiIRk0fwsVV0dhCA', 'Dezembro 2025', false, '2025-01-01')
on conflict (id) do update set ativa = false;
