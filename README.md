# MCM Gestão

Painel da MCM Formatura para acompanhar eventos, formandos, itens de produção, fornecedores, pagamentos e lucro por item. Inclui login com e-mail e senha e recuperação de senha por e-mail (link ou código).

## Como funciona

- Site estático: `index.html` + `app.js`, sem etapa de build.
- Dados e login: [Supabase](https://supabase.com) (Postgres + Auth). A estrutura do banco está em [`supabase/001_estrutura.sql`](supabase/001_estrutura.sql).
- Acesso: só e-mails cadastrados na tabela `membros` enxergam os dados (regras de RLS no banco). A chave que aparece em `app.js` é a chave pública do Supabase; ela sozinha não dá acesso a nada.

## Pastas do painel

- **Novo pedido**: lança itens por setor (papelaria, lembranças, copos, doces, montagem).
- **Atualiza sozinho**: quando a planilha do Google ou outra pessoa muda algo, a tela se atualiza em poucos segundos (sem F5; espera terminar de digitar).
- **Próximas entregas** (página inicial): turmas pela data de entrega, com atrasadas, próximos 7 e 30 dias, produção pronta, fornecedor a escolher e saldo a receber; botão para dar baixa de entrega na turma inteira.
- **Busca rápida** no topo (atalho /): acha cliente ou turma e abre direto a ficha.
- **Renomear pasta**: dentro de cada pasta de turma, o botão "Renomear pasta" ao lado do título muda nome, mês e dia (o link da pasta continua o mesmo).
- **Organizar pedidos**: cria turmas em cada mês, renomeia, muda o mês/dia, exclui turmas vazias e move clientes entre turmas (um a um ou vários marcados de uma vez). Cada turma é uma pasta do menu.
- **Visão geral**: eventos, recebimentos e status da produção do mês escolhido no seletor **Período** do topo.
- **Itens e lucro**: preço de venda × custo do fornecedor por produto, no mês escolhido.
- **Resumo do mês**: cada produto somado em todos os eventos do mês escolhido.
- **Estoque de copos**: entradas e saídas de copos e taças, estoque mínimo e quanto falta comprar para os pedidos (tabelas `estoque_movimentos` e `copos_config`).
- **Estoque geral**: estoque de cada produto × itens dos pedidos que ainda não estão prontos, com a lista do que falta pedir por fornecedor (tabela `estoque_geral`).
- **Pastas dos eventos**: agrupadas por mês, com cada formando, seus itens, fornecedor, status e pagamentos. Na ficha de cada cliente dá para lançar pagamento (valor, data, para quem foi pago, situação e observação), marcar um previsto como pago e apagar um lançamento. Itens da Império têm o campo **nº do pedido** ao lado da data do pedido (também em lote na aba Produção) e a busca acha pelo número. Necessaires, bolsas, sacolas, chinelas, caixas cartonadas, gin box, bonés, aventais, guardanapos, gloss e menu de acrílico têm o campo **Prazo** do fornecedor (vermelho quando vence, laranja a 3 dias), também em lote e com filtro na aba Produção. Cada item tem um botão × para excluir do pedido (pede confirmação); o banco guarda uma cópia de todo item excluído na tabela `itens_excluidos`, para poder restaurar. Guardanapos e bolsas têm também o campo **Cores** na coluna de observação, na ficha e na aba Produção (a busca da produção acha pela cor). ID visual, taxa de papelaria e vetorização têm um campo para o **link do Drive**, com botão para abrir. Copos, copo cuia/térmico, gloss/lip balm e pulseira de LED têm a barra **DTF** (em produção / em loja); bolsas e necessaires Letícia também, com a opção "com o costureiro". O menu provençal tem a barra **Tassel** (já está com tassel / ainda sem tassel), tags, bottons, aventais e óculos têm a barra **Solicitado ao cliente** (sim / ainda não), e marcadores de mesa têm a mesma barra com o nome **Nomes solicitados**, guardanapos têm a barra **Separados em loja** (sim / ainda não) e o bastão de LED tem a barra **Adesivo** (em produção / em loja) no lugar do DTF e guardanapos com tag e caixas de acrílico têm a barra **Tag** (em produção / em loja / com a costureira), embaixo do status. Cada categoria da ficha termina com um espaço de **observação final**, que também pode ser preenchido por setor no Novo pedido.


## Planilhas do Google → site

As alterações nas planilhas de orçamento chegam ao site sozinhas: um script do Google (`integracao-planilhas/Codigo.gs`, instalação em [`integracao-planilhas/COMO-INSTALAR.md`](integracao-planilhas/COMO-INSTALAR.md)) envia a aba alterada para a função `receber-planilha` do Supabase (`supabase/functions/receber-planilha`). A planilha manda em itens, quantidades, valores, pagamentos e descontos; status, fornecedor, pedido, prazo, barras e cores continuam sendo do site. Cada aba fica ligada a um cliente pela tabela `planilha_abas`, e cada envio é registrado em `planilha_sync_log`. A função só aceita quem tem a senha da integração; o banco guarda apenas o resumo sha256 dela, na tabela `integracao_tokens`.

## Telas de acesso

1. **Entrar**: e-mail e senha.
2. **Esqueci minha senha**: envia um e-mail de recuperação.
3. **Criar nova senha**: pelo link do e-mail ou digitando o código que veio nele.
4. **Criar conta** (link direto: `/cadastro`): e-mail, senha e o **código da equipe**. Com o código certo a conta entra como membro na hora, sem administrador (depois de confirmar o e-mail). Quem já tem conta sem acesso também pode digitar o código na tela "Acesso não liberado". O banco guarda só o resumo do código (tabela `codigo_equipe`) e barra 5 tentativas erradas por hora; para trocar o código, veja `supabase/021_cadastro_codigo_equipe.sql`.

## Rodar no computador

No computador o site usa o mesmo Supabase do site no ar: entra com o mesmo e-mail e senha, e toda mudança vale de verdade. Precisa do arquivo `.env` (veja abaixo). Para iniciar no Windows:

```
powershell -NoProfile -ExecutionPolicy Bypass -File servir.ps1
```

Depois abra http://localhost:5173.

## Variáveis de ambiente

| Variável | O que é |
| --- | --- |
| `SUPABASE_URL` | Endereço do projeto, ex.: `https://xxxx.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Chave **pública** do Supabase (`sb_publishable_...` ou `anon`). Nunca a chave secreta. |

- No computador: copie `.env.example` para `.env` e preencha. O `servir.ps1` gera o `config.js` a partir dele.
- Na Vercel: cadastre as duas em **Project Settings → Environment Variables**. O build (`node scripts/build.js`) gera `dist/config.js` e recusa publicar se a chave for secreta.

## Publicar

1. No Supabase: rodar os arquivos de `supabase/` em ordem (`001_estrutura.sql`, `002_administradores.sql`, `003_estoque.sql`, `004_pagamentos_recebedor.sql`, `005_codigo_pedido.sql`, `006_obs_cores.sql`, `007_obs_categorias.sql`, `008_dtf_tag.sql`, `009_dtf_costureiro.sql`, `010_tassel.sql`, `011_solicitado_cliente.sql`, `012_separado_loja.sql`, `013_adesivo.sql`, `014_link_drive.sql`, `015_itens_excluidos.sql`, `016_lixeira_sem_rpc.sql`, `017_prazo.sql`, `018_integracao_planilhas.sql`, `019_planilhas_ativa.sql`, `020_tempo_real.sql`, `021_cadastro_codigo_equipe.sql`), importar os dados e cadastrar os e-mails da equipe em `membros`.
2. Na Vercel: **Add New → Project → Import** deste repositório. Framework Preset: **Other**. O `vercel.json` já define o build e a pasta `dist`. Cadastre as variáveis de ambiente antes do primeiro deploy.
3. No Supabase, em Authentication → URL Configuration: colocar o endereço da Vercel em **Site URL** e em **Redirect URLs**, para o link de recuperação voltar ao site.
4. Em Authentication → Email Templates → Reset Password: incluir `{{ .Token }}` para o e-mail trazer também o código.
