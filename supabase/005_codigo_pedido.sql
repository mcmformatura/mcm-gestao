-- Código do pedido no fornecedor (ex.: número do pedido da Império), por item
alter table public.itens add column if not exists codigo_pedido text
  check (codigo_pedido is null or length(trim(codigo_pedido)) between 1 and 40);

-- Itens da Império que já tinham o número do pedido (5 dígitos começando com 1) escrito na observação
update public.itens i
   set codigo_pedido = (select string_agg(m[1], ' / ') from regexp_matches(i.obs, '(?:^|\D)(1\d{4})(?!\d)', 'g') m)
  from public.fornecedores s
 where s.id = i.fornecedor_id and s.nome ilike 'imp%rio'
   and i.codigo_pedido is null and i.obs ~ '(^|\D)1\d{4}(\D|$)';
