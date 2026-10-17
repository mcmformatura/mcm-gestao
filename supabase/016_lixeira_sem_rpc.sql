-- A função da lixeira só roda pelo gatilho de exclusão; ninguém precisa chamá-la pela API
revoke execute on function public.guardar_item_excluido() from public, anon, authenticated;
