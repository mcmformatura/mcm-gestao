# Planilhas do Google → site, na hora

Depois de instalado, qualquer alteração numa aba de orçamento (item, quantidade, valor, linha de PAGO / A PAGAR, desconto) aparece no site em poucos segundos. Um único script acompanha todas as planilhas, inclusive as dos próximos meses.

## Instalar (uma vez só, uns 5 minutos)

1. Entre em **script.google.com** com a conta **mcmformatura@gmail.com** (a dona das planilhas) e clique em **Novo projeto**.
2. Apague o que estiver escrito e cole todo o conteúdo do arquivo `Codigo.gs`.
3. Na linha `const SENHA = 'COLE_A_SENHA_AQUI';` troque `COLE_A_SENHA_AQUI` pela **senha da integração** (fica nas aspas).
4. Clique no nome "Projeto sem título", lá em cima, e chame de **MCM Gestão - planilhas**. Salve com **Ctrl+S**.
5. Na barra de cima, escolha a função **ativar** e clique em **Executar**.
6. O Google vai pedir autorização: **Revisar permissões** → escolha a conta → aparece "O Google não verificou este app" → **Avançado** → **Acessar MCM Gestão - planilhas (não seguro)** → **Permitir**.
   Esse aviso é normal: o script é seu e só fala com o seu site.
7. No **Registro de execução** aparece "Envio automático ligado em X planilhas" com a lista. Pronto.

## Testar

Abra uma aba de cliente, mude uma quantidade e aguarde: aparece um aviso no canto da planilha ("… 1 item(ns) alterado(s) ✓"). Atualize o site e confira.

## Como funciona

- **Cada aba é um cliente.** A ligação é pelo código interno da aba, então pode renomear a aba à vontade.
- **Aba nova com orçamento** (linha com "QNTD" na coluna B) vira cliente novo no site. Ele vai para a turma da data que estiver no nome da aba, ou para a turma padrão daquela planilha.
- **Itens:** a planilha manda no nome, quantidade, valor e brinde. Status, fornecedor, data/nº do pedido, prazo, barras e cores ficam como foram marcados no site.
- **Item apagado da planilha** sai do site, mas fica guardado na lixeira. Se a linha só foi recortada e colada em outro lugar, o item volta com tudo o que estava marcado.
- **Pagamentos:** as linhas PAGO / A PAGAR / desconto da planilha substituem as que vieram da planilha antes. Os pagamentos lançados direto no site nunca são apagados.
- **Planilha do mês novo:** todo dia às 6h o script procura planilhas com mês e ano no nome (ex.: "MAIO DE 2027") e passa a acompanhar.

## Outras funções (escolha na barra e clique em Executar)

- **enviarTudo**: manda todas as abas de todas as planilhas de uma vez.
- **desativar**: desliga o envio automático.
