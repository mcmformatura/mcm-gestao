-- ID visual, taxa de papelaria e vetorização: link da pasta/arquivo no Google Drive
alter table public.itens add column if not exists link_drive text
  check (link_drive is null or (link_drive ~* '^https?://' and length(link_drive) <= 500));
