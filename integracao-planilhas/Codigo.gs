/**
 * MCM Gestão: envia para o site, na hora, cada alteração feita nas planilhas de orçamento do Google.
 *
 * Um único script acompanha TODAS as planilhas (não precisa instalar em cada uma).
 * Instalação: veja integracao-planilhas/COMO-INSTALAR.md
 *
 * O que vai da planilha para o site: itens, quantidades, valores, pagamentos (linhas PAGO / A PAGAR) e descontos.
 * O que o site guarda e a planilha não mexe: status, fornecedor, data e nº do pedido, prazo, barras e cores.
 */

// >>> Cole aqui, entre as aspas, a senha da integração que o Claude passou <<<
const SENHA = 'COLE_A_SENHA_AQUI';

const ENDERECO = 'https://ktibfvbsijtusbhkrlaq.supabase.co/functions/v1/receber-planilha';
// Planilhas novas são achadas sozinhas pelo nome (mês + ano, ex.: "MARÇO DE 2027", "Janeiro 2027 - ...")
const NOME_DE_MES = /(JANEIRO|FEVEREIRO|MAR[CÇ]O|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO).*20\d\d/i;
const MAX_PLANILHAS = 18;   // o Google permite 20 gatilhos por script; 2 ficam para o envio diário e folga
const MUDANCAS_QUE_ENVIAM = ['EDIT', 'INSERT_ROW', 'REMOVE_ROW', 'INSERT_COLUMN', 'REMOVE_COLUMN', 'OTHER'];

/** 1º passo (rodar uma vez): liga o envio automático em todas as planilhas. */
function ativar() {
  conferirSenha_();
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  const planilhas = planilhasAcompanhadas_();
  planilhas.forEach(p => ScriptApp.newTrigger('aoMudar').forSpreadsheet(p.id).onChange().create());
  // todo dia de manhã procura planilhas novas (ex.: a do mês que vem) e liga nelas também
  ScriptApp.newTrigger('ativar').timeBased().everyDays(1).atHour(6).create();
  Logger.log('Envio automático ligado em %s planilhas:\n%s', planilhas.length, planilhas.map(p => '• ' + p.titulo).join('\n'));
}

/** Desliga o envio automático. */
function desativar() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('Envio automático desligado.');
}

/** Envia de uma vez todas as abas de todas as planilhas (útil na primeira vez ou para conferir tudo). */
function enviarTudo() {
  conferirSenha_();
  planilhasAcompanhadas_().forEach(p => {
    const ss = SpreadsheetApp.openById(p.id);
    ss.getSheets().forEach(sh => Logger.log(enviarAba_(ss, sh)));
  });
}

/** Chamado pelo Google a cada alteração numa planilha acompanhada. */
function aoMudar(e) {
  if (e && e.changeType && MUDANCAS_QUE_ENVIAM.indexOf(e.changeType) < 0) return;
  const ss = (e && e.source) || SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();
  const trava = LockService.getScriptLock();
  if (!trava.tryLock(30000)) return;
  try {
    const resumo = enviarAba_(ss, sh);
    try { ss.toast(resumo, 'MCM Gestão', 6); } catch (err) { /* sem tela aberta */ }
  } finally {
    trava.releaseLock();
  }
}

// ---------- internos ----------

function enviarAba_(ss, sh) {
  const ultima = sh.getLastRow();
  if (!ultima) return sh.getName() + ': aba vazia';
  const linhas = sh.getRange(1, 1, Math.min(ultima, 2000), 8).getDisplayValues();
  if (!linhas.some(l => String(l[1]).trim().toUpperCase() === 'QNTD')) return sh.getName() + ': sem orçamento (não enviada)';
  const r = chamar_({ planilha_id: ss.getId(), planilha_titulo: ss.getName(), aba: { gid: sh.getSheetId(), titulo: sh.getName(), linhas: linhas } });
  if (r.erro) return sh.getName() + ': ' + r.erro;
  if (r.ignorada) return sh.getName() + ': aba marcada para não ir ao site';
  return (r.resultados || []).map(x => {
    if (x.erro) return sh.getName() + ': ' + x.erro;
    if (x.semMudanca) return sh.getName() + ': já estava igual no site';
    const partes = [];
    if (x.novoCliente) partes.push('cliente novo criado');
    if (x.novos) partes.push(x.novos + ' item(ns) novo(s)');
    if (x.alterados) partes.push(x.alterados + ' item(ns) alterado(s)');
    if (x.removidos) partes.push(x.removidos + ' item(ns) tirado(s)');
    if (x.pagamentos) partes.push('pagamentos atualizados');
    return sh.getName() + ': ' + (partes.join(', ') || 'atualizado') + ' ✓';
  }).join('\n');
}

function planilhasAcompanhadas_() {
  const conhecidas = (chamar_({ acao: 'lista' }).planilhas || []).map(p => ({ id: p.id, titulo: p.titulo || p.id }));
  const ids = {};
  conhecidas.forEach(p => { ids[p.id] = true; });
  // planilhas novas: nome com mês e ano, mexidas nos últimos 45 dias e com orçamento (coluna B = "QNTD")
  const desde = new Date(Date.now() - 45 * 864e5).toISOString();
  const achados = DriveApp.searchFiles("mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false and modifiedDate > '" + desde + "'");
  const novas = [];
  while (achados.hasNext()) {
    const f = achados.next();
    if (ids[f.getId()] || !NOME_DE_MES.test(f.getName())) continue;
    try {
      const ss = SpreadsheetApp.openById(f.getId());
      const temOrcamento = ss.getSheets().slice(0, 5).some(sh => sh.getLastRow() && sh.getRange(1, 2, Math.min(sh.getLastRow(), 60), 1).getDisplayValues().some(l => String(l[0]).trim().toUpperCase() === 'QNTD'));
      if (temOrcamento) novas.push({ id: f.getId(), titulo: f.getName(), quando: f.getLastUpdated() });
    } catch (err) { /* sem acesso */ }
  }
  novas.sort((a, b) => b.quando - a.quando);
  return novas.concat(conhecidas).slice(0, MAX_PLANILHAS);
}

function chamar_(corpo) {
  corpo.token = SENHA;
  const resp = UrlFetchApp.fetch(ENDERECO, { method: 'post', contentType: 'application/json', payload: JSON.stringify(corpo), muteHttpExceptions: true });
  let r;
  try { r = JSON.parse(resp.getContentText()); } catch (err) { r = { erro: 'resposta inesperada do site (' + resp.getResponseCode() + ')' }; }
  if (resp.getResponseCode() === 401) throw new Error('Senha da integração errada: confira a linha SENHA no topo do script.');
  return r;
}

function conferirSenha_() {
  if (!SENHA || SENHA === 'COLE_A_SENHA_AQUI') throw new Error('Cole a senha da integração na linha SENHA, no topo do script, e salve.');
}
