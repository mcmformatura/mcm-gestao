# MCM Gestão

Painel da MCM Formatura para acompanhar eventos, formandos, itens de produção, fornecedores, pagamentos e lucro por item. Inclui login com e-mail e senha e recuperação de senha por e-mail (link ou código).

## Como funciona

- Site estático: `index.html` + `app.js`, sem etapa de build.
- Dados e login: [Supabase](https://supabase.com) (Postgres + Auth). A estrutura do banco está em [`supabase/001_estrutura.sql`](supabase/001_estrutura.sql).
- Acesso: só e-mails cadastrados na tabela `membros` enxergam os dados (regras de RLS no banco). A chave que aparece em `app.js` é a chave pública do Supabase; ela sozinha não dá acesso a nada.

## Pastas do painel

- **Novo pedido**: lança itens por setor (papelaria, lembranças, copos, doces, montagem).
- **Próximas entregas** (página inicial): turmas pela data de entrega, com atrasadas, próximos 7 e 30 dias, produção pronta, fornecedor a escolher e saldo a receber; botão para dar baixa de entrega na turma inteira.
- **Busca rápida** no topo (atalho /): acha cliente ou turma e abre direto a ficha.
- **Organizar pedidos**: cria turmas em cada mês, renomeia, muda o mês/dia, exclui turmas vazias e move clientes entre turmas (um a um ou vários marcados de uma vez). Cada turma é uma pasta do menu.
- **Visão geral**: eventos, recebimentos e status da produção do mês escolhido no seletor **Período** do topo.
- **Itens e lucro**: preço de venda × custo do fornecedor por produto, no mês escolhido.
- **Resumo do mês**: cada produto somado em todos os eventos do mês escolhido.
- **Estoque de copos**: entradas e saídas de copos e taças, estoque mínimo e quanto falta comprar para os pedidos (tabelas `estoque_movimentos` e `copos_config`).
- **Estoque geral**: estoque de cada produto × itens dos pedidos que ainda não estão prontos, com a lista do que falta pedir por fornecedor (tabela `estoque_geral`).
- **Pastas dos eventos**: agrupadas por mês, com cada formando, seus itens, fornecedor, status e pagamentos. Na ficha de cada cliente dá para lançar pagamento (valor, data, para quem foi pago, situação e observação), marcar um previsto como pago e apagar um lançamento. Itens da Império têm o campo **nº do pedido** ao lado da data do pedido (também em lote na aba Produção) e a busca acha pelo número. Guardanapos e bolsas têm também o campo **Cores** na coluna de observação, na ficha e na aba Produção (a busca da produção acha pela cor). Copos têm a barra **DTF** (em produção / em loja); bolsas e necessaires Letícia também, com a opção "com o costureiro" e guardanapos com tag têm a barra **Tag** (em produção / em loja / com a costureira), embaixo do status. Cada categoria da ficha termina com um espaço de **observação final**, que também pode ser preenchido por setor no Novo pedido.

## Telas de acesso

1. **Entrar**: e-mail e senha.
2. **Esqueci minha senha**: envia um e-mail de recuperação.
3. **Criar nova senha**: pelo link do e-mail ou digitando o código que veio nele.

## Rodar no computador (modo local)

Em `localhost` o site entra em **modo local**: imita o Supabase dentro do navegador, sem internet. Os e-mails de recuperação aparecem numa "caixa de entrada de teste" na própria tela.

O modo local precisa de dois arquivos que **não vão para o GitHub** porque têm dados reais de clientes e senhas de teste:

- `dados-locais.json`: cópia dos eventos, formandos, itens e pagamentos;
- `usuarios-locais.json`: usuários de teste, no formato
  `{ "usuarios": [ { "email": "voce@exemplo.com", "senha": "uma-senha-de-teste", "membro": true } ] }`

Para iniciar no Windows:

```
powershell -NoProfile -ExecutionPolicy Bypass -File servir.ps1
```

Depois abra http://localhost:5173. Opções no endereço:

- `?reset` volta os dados de teste ao original;
- `?supabase` usa o Supabase de verdade mesmo em localhost.

## Variáveis de ambiente

| Variável | O que é |
| --- | --- |
| `SUPABASE_URL` | Endereço do projeto, ex.: `https://xxxx.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Chave **pública** do Supabase (`sb_publishable_...` ou `anon`). Nunca a chave secreta. |

- No computador: copie `.env.example` para `.env` e preencha. O `servir.ps1` gera o `config.js` a partir dele.
- Na Vercel: cadastre as duas em **Project Settings → Environment Variables**. O build (`node scripts/build.js`) gera `dist/config.js` e recusa publicar se a chave for secreta.

## Publicar

1. No Supabase: rodar os arquivos de `supabase/` em ordem (`001_estrutura.sql`, `002_administradores.sql`, `003_estoque.sql`, `004_pagamentos_recebedor.sql`, `005_codigo_pedido.sql`, `006_obs_cores.sql`, `007_obs_categorias.sql`, `008_dtf_tag.sql`, `009_dtf_costureiro.sql`), importar os dados e cadastrar os e-mails da equipe em `membros`.
2. Na Vercel: **Add New → Project → Import** deste repositório. Framework Preset: **Other**. O `vercel.json` já define o build e a pasta `dist`. Cadastre as variáveis de ambiente antes do primeiro deploy.
3. No Supabase, em Authentication → URL Configuration: colocar o endereço da Vercel em **Site URL** e em **Redirect URLs**, para o link de recuperação voltar ao site.
4. Em Authentication → Email Templates → Reset Password: incluir `{{ .Token }}` para o e-mail trazer também o código.
