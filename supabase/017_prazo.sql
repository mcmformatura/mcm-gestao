-- Prazo combinado com o fornecedor (necessaire, bolsa, sacola, chinela, caixa cartonada, gin box,
-- boné, avental, guardanapo, gloss e menu de acrílico)
alter table public.itens add column if not exists prazo date;
create index if not exists itens_prazo_idx on public.itens(prazo) where prazo is not null;
