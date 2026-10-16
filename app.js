"use strict";
/* MCM Gestão: painel de eventos, formandos e produção, com dados e login no Supabase */
// Endereço e chave pública do Supabase vêm do config.js, gerado a partir do .env (local) ou das variáveis de ambiente da Vercel
const CONFIG = window.MCM_CONFIG || {};
const HASH_INICIAL = location.hash || "";   // lido antes do Supabase limpar o link de recuperação
function semConfig() {
  document.getElementById("boot").innerHTML = "<div><b>Configuração ausente.</b> Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY (arquivo .env ou variáveis de ambiente da Vercel) e publique de novo.</div>";
  throw new Error("MCM_CONFIG ausente");
}
const sb = window.MCM_LOCAL ? window.MCM_LOCAL.client
  : (CONFIG.supabaseUrl && CONFIG.supabaseKey) ? supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
    })
  : semConfig();

const EVENTOS = [];          // carregados do banco
const DATA_OK = /^\d{4}-\d{2}-\d{2}$/;
const fmtData = d => DATA_OK.test(d || "") ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "";

// Mês dos eventos: o seletor do topo filtra a visão geral, o resumo do mês e o lucro
const NOMES_MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const mesDe = e => (e && e.data && e.data.length >= 10) ? `${e.data.slice(6, 10)}-${e.data.slice(3, 5)}` : "sem-data";
const rotuloDe = m => m === "todos" ? "Todos os meses" : m === "sem-data" ? "Sem data" : `${NOMES_MES[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
let MES_SEL = (() => { try { return localStorage.getItem("mcm-mes") || "todos"; } catch (e) { return "todos"; } })();
const rotuloMes = () => rotuloDe(MES_SEL);
const mesesDisponiveis = () => [...new Set(EVENTOS.map(mesDe))].sort();
const EVMes = () => MES_SEL === "todos" ? EVENTOS : EVENTOS.filter(e => mesDe(e) === MES_SEL);
const FMes = () => { if (MES_SEL === "todos") return F; const ids = new Set(EVMes().map(e => e.id)); return F.filter(f => ids.has(f.ev)); };

const CAT = { PAPELARIA: "Papelaria", LEMBRANCAS: "Lembranças", COPOS: "Copos", DOCES: "Doces", MONTAGEM: "Montagem", LOCACAO: "Locação", OUTROS: "Outros" };
const CAT_ORDER = ["PAPELARIA", "LEMBRANCAS", "COPOS", "DOCES", "LOCACAO", "MONTAGEM", "OUTROS"];
const PRODUCAO = new Set(["PAPELARIA", "LEMBRANCAS", "COPOS"]);
const STATUS = [
  ["AGUARDANDO_PRODUCAO", "Aguardando produção", "var(--accent)"],
  ["REPASSADO", "Repassado ao fornecedor", "var(--violet)"],
  ["EM_PRODUCAO", "Em produção", "var(--gold)"],
  ["PRONTO", "Pronto / em loja", "color-mix(in srgb, var(--good) 60%, var(--surface))"],
  ["ENTREGUE", "Entregue", "var(--good)"],
];
const STATUS_LABEL = Object.fromEntries(STATUS.map(([k, l]) => [k, l]));
const PROPRIA = "Produção Própria MCM";

// Fornecedores possíveis por produto (catálogo); os demais aparecem em "Outros fornecedores"
const CANDIDATOS = [
  [/identidade visual|id visual|^id$|taxa.*(id|papelaria|arte)|vetoriza/, ["WEV", "Jonas", "Naya", "Ronan", "Evane"]],
  [/guardanapo/, ["Aurisete", "Francieulda", "Paty"]],
  [/necessaire|ncessaire|mini hel/, ["Joziel", "Alex", "Ateliê Michaelio"]],
  [/bolsa(?!inha)/, ["Paty", "Marcelo"]],
  [/gloss|lip ?b/, ["Ecskin", PROPRIA]],
  [/cartonad/, ["Gin Box", "Luciana"]],
  [/avental (com foto|garçom)/, ["Casa da Cópia", "Paty"]],
  [/avental/, ["Felipe"]],
  [/souplast|\bmenu\b|bottons?|marcador|^\s*lacres?|tags? (p\/|da |de |para )?(sacola|ecobag)/, ["Casa da Cópia"]],
  [/sacola|hot ?stamping|\bhot\b|gorgur/, ["Império"]],
  [/tags? acr[ií]lico/, ["VM"]],
  [/chinel|rasteira/, ["Pé&Pé"]],
  [/bon[eé]|dad hat/, ["Shop Boné"]],
  [/ta[cç]a|copo|champanheira|balde|havaian|ecobag|caixa.*acr[ií]lico|caixinha|bast[aã]o|tag.*nome|dtf|adesivo/, [PROPRIA]],
];
const candidatosDe = produto => { const p = produto.toLowerCase(); for (const [re, l] of CANDIDATOS) if (re.test(p)) return l; return []; };

const brl = v => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const int = v => v.toLocaleString("pt-BR");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const folderIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l1.8 2h8.6A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/></svg>`;
const gridIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg>`;
const plusIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 4h3v6.5H20v3h-6.5V20h-3v-6.5H4v-3h6.5z"/></svg>`;
const coinIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm.9 4h-1.8v1.1c-1.5.3-2.5 1.3-2.5 2.6 0 1.6 1.3 2.2 2.9 2.6 1.3.3 1.7.6 1.7 1.1s-.5.9-1.3.9c-.9 0-1.5-.4-1.7-1.1H8.4c.2 1.4 1.2 2.4 2.7 2.7V18h1.8v-1.1c1.6-.3 2.6-1.3 2.6-2.7 0-1.7-1.3-2.3-3-2.7-1.2-.3-1.6-.5-1.6-1s.5-.8 1.2-.8c.7 0 1.2.3 1.4.9h1.8c-.2-1.3-1.1-2.2-2.4-2.5z"/></svg>`;
const listIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h3v3H4zM9 5.5h11v2H9zM4 10.5h3v3H4zM9 11h11v2H9zM4 16h3v3H4zM9 16.5h11v2H9z"/></svg>`;
const boxIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 21 7v10l-9 4.5L3 17V7zm0 2.2L6.2 7.6 12 10.5l5.8-2.9zM5 9.2v6.6l6 3V12.2zm14 0-6 3v6.6l6-3z"/></svg>`;
const cupIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14l-1.6 16.2A2 2 0 0 1 15.4 21H8.6a2 2 0 0 1-2-1.8zm2.2 2 .5 5h8.6l.5-5z"/></svg>`;


/* ---------- Estado ---------- */
let LIVE = false;           // dados carregados e edição liberada
let USER = null;            // usuário conectado
let SUP = {};               // id do fornecedor -> nome
let SUP_BY_NAME = {};       // nome -> id
let F = [];                 // formandos com itens e pagamentos
let ITEM = {};              // id -> item
let FO_INFO = {};           // id do formando -> { nome, ev }
const PEDIDOS = {};         // id do pedido -> pedido lançado pelo painel
const OBS_CAT = {};         // "formando|CATEGORIA" -> observação final da categoria
const chaveObsCat = (fo, cat) => `${fo}|${cat}`;

function recalc(f) {
  f.itens.forEach(i => { i.escolher = !i.fornId && PRODUCAO.has(i.cat); });
  f.total = f.itens.reduce((a, x) => a + (x.vt || 0), 0);
  f.desconto = f.pg.filter(p => p.tipo === "DESCONTO").reduce((a, p) => a + p.valor, 0);
  f.pago = f.pg.filter(p => p.tipo === "PARCELA" && p.status === "PAGO").reduce((a, p) => a + p.valor, 0);
  f.devido = f.total - f.desconto;
  f.saldo = Math.max(0, Math.round((f.devido - f.pago) * 100) / 100);
  f.nEscolher = f.itens.filter(i => i.escolher).length;
}

/* ---------- Banco (Supabase) ---------- */
// O Supabase devolve no máximo 1000 linhas por consulta: busca em páginas
async function todos(tabela, colunas, ordem) {
  const out = [], passo = 1000;
  for (let de = 0; ; de += passo) {
    let q = sb.from(tabela).select(colunas);
    (ordem || []).forEach(o => { q = q.order(o, { ascending: true }); });
    const { data, error } = await q.range(de, de + passo - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < passo) return out;
  }
}

async function carregar() {
  const [evs, fos, its, pgs, sups, cus, peds, movs, cfgs, egs, ocs] = await Promise.all([
    todos("eventos", "id,nome,data,slug,ordem", ["ordem", "data", "nome"]),
    todos("formandos", "id,evento_id,nome", ["nome", "id"]),
    todos("itens", "id,formando_id,pedido_id,ordem,produto,fornecedor_id,qtd,valor_unit,valor_total,categoria,brinde,obs,status,pedido_em,codigo_pedido,obs_cores,dtf_status,tag_status,tassel_status,solicitado_status,separado_status,adesivo_status,link_drive", ["formando_id", "ordem", "id"]),
    todos("pagamentos", "id,formando_id,ordem,descricao,valor,data,status,tipo,obs,recebedor", ["formando_id", "ordem", "id"]),
    todos("fornecedores", "id,nome", ["nome"]),
    todos("custos", "chave,produto,custo,venda", ["chave"]),
    todos("pedidos", "id,formando_id,formando_novo,total,criado_em", ["criado_em"]),
    todos("estoque_movimentos", "id,modelo,tipo,qtd,data,obs,criado_em", ["data", "criado_em"]),
    todos("copos_config", "chave,nome,minimo", ["chave"]),
    todos("estoque_geral", "chave,produto,categoria,qtd,minimo,avulso", ["chave"]),
    todos("obs_categorias", "formando_id,categoria,obs", ["formando_id", "categoria"]),
  ]);
  const n = v => v == null ? null : +v;

  EVENTOS.length = 0;
  evs.forEach(e => EVENTOS.push({ id: e.id, nome: e.nome, data: fmtData(e.data) || "", slug: e.slug }));
  ordenarEventos();

  SUP = {}; SUP_BY_NAME = {};
  sups.forEach(s => { SUP[s.id] = s.nome; SUP_BY_NAME[s.nome] = s.id; });

  Object.keys(CUSTOS).forEach(k => { delete CUSTOS[k]; });
  cus.forEach(c => { CUSTOS[c.chave] = { produto: c.produto, custo: n(c.custo), venda: n(c.venda) }; });

  [MOVS, COPOS_CFG, EGERAL, OBS_CAT].forEach(o => Object.keys(o).forEach(k => { delete o[k]; }));
  ocs.forEach(o => { OBS_CAT[chaveObsCat(o.formando_id, o.categoria)] = o.obs || ""; });
  movs.forEach(m => { MOVS[m.id] = { modelo: m.modelo, tipo: m.tipo, qtd: +m.qtd || 0, data: m.data, obs: m.obs || "", em: m.criado_em }; });
  cfgs.forEach(c => { COPOS_CFG[c.chave] = { nome: c.nome, minimo: n(c.minimo) }; });
  egs.forEach(e => { EGERAL[e.chave] = { produto: e.produto, cat: e.categoria, qtd: n(e.qtd), minimo: n(e.minimo), custom: !!e.avulso }; });

  ITEM = {}; FO_INFO = {};
  const porFo = {}, porPedido = {};
  its.forEach(r => {
    const it = {
      id: r.id, fo: r.formando_id, produto: r.produto, fornId: r.fornecedor_id && SUP[r.fornecedor_id] ? r.fornecedor_id : null,
      qtd: +r.qtd || 0, vu: n(r.valor_unit), vt: n(r.valor_total), cat: CAT[r.categoria] ? r.categoria : "OUTROS",
      brinde: !!r.brinde, obs: r.obs || "", status: r.status, pedido: r.pedido_em || "", codigo: r.codigo_pedido || "", cores: r.obs_cores || "", dtf: r.dtf_status || "", tag: r.tag_status || "", tassel: r.tassel_status || "", solicitado: r.solicitado_status || "", separado: r.separado_status || "", adesivo: r.adesivo_status || "", link: r.link_drive || "", novo: !!r.pedido_id,
    };
    ITEM[it.id] = it;
    (porFo[it.fo] = porFo[it.fo] || []).push(it);
    if (r.pedido_id) (porPedido[r.pedido_id] = porPedido[r.pedido_id] || []).push(it);
  });
  const pgPorFo = {};
  pgs.forEach(p => {
    (pgPorFo[p.formando_id] = pgPorFo[p.formando_id] || []).push({ id: p.id, ordem: p.ordem || 0, desc: p.descricao || "", valor: +p.valor || 0, data: p.data, status: p.status, tipo: p.tipo, obs: p.obs || "", recebedor: p.recebedor || "" });
  });
  F = fos.map(f => {
    FO_INFO[f.id] = { nome: f.nome, ev: f.evento_id };
    return { id: f.id, ev: f.evento_id, nome: f.nome, itens: porFo[f.id] || [], pg: pgPorFo[f.id] || [] };
  });
  F.forEach(recalc);

  Object.keys(PEDIDOS).forEach(k => { delete PEDIDOS[k]; });
  peds.forEach(p => {
    const info = FO_INFO[p.formando_id] || {}, ev = EVENTOS.find(e => e.id === info.ev) || {};
    PEDIDOS[p.id] = {
      evento: { id: ev.id, nome: ev.nome }, formando: p.formando_novo ? { nome: info.nome } : { id: p.formando_id, nome: info.nome },
      itens: porPedido[p.id] || [], total: +p.total || 0, criadoEm: p.criado_em, sync: true,
    };
  });
}

function setConn(state, html) {
  const c = document.getElementById("conn");
  c.dataset.state = state;
  document.getElementById("connMsg").innerHTML = html;
}
function connMsg() {
  if (!LIVE) return;
  const txt = window.MCM_LOCAL
    ? `<b>Modo local.</b> As mudanças ficam salvas só neste navegador, para testes.`
    : `<b>Conectado ao banco.</b> Cada mudança fica salva na hora para toda a equipe.`;
  setConn("live", `${txt} <button class="btn" type="button" id="recarregar">Atualizar dados</button>`);
  document.getElementById("recarregar").addEventListener("click", recarregar);
}
async function recarregar() {
  setConn("loading", "Atualizando os dados…");
  try { await carregar(); LIVE = true; preencherMeses(); connMsg(); renderFolders(); render(); }
  catch (e) { setConn("error", `<b>Não atualizou.</b> ${esc(erroDb(e))}. <button class="btn" type="button" id="recarregar">Tentar de novo</button>`); document.getElementById("recarregar").addEventListener("click", recarregar); }
}
function erroDb(e) {
  const m = String((e && (e.message || e.error_description || e.msg)) || "");
  if (/jwt|token|session|not authenticated/i.test(m)) return "sua sessão expirou; saia e entre de novo";
  if (/permission|policy|row-level|sem permiss|nada foi salvo/i.test(m)) return "sem permissão para salvar";
  if (/fetch|network|failed to|load failed/i.test(m)) return "sem conexão com o servidor; confira a internet e tente de novo";
  return "não salvou; tente de novo";
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
// Fornecedor que trabalha com número de pedido (a Império manda um código para cada pedido)
const ehImperio = fornId => /imp[eé]rio/i.test(SUP[fornId] || "");
// Guardanapos e bolsas (não tag, lacre, adicional de bolsa nem bolsa cartonada) têm um campo próprio para as cores
const temCores = produto => /^\s*(guardanapos?|bolsa)\b/i.test(produto || "") && !/cartonad/i.test(produto || "");
// Onde está o DTF (copos, copo cuia/térmico, gloss/lip balm, pulseira de LED, bolsas e necessaire Letícia) e a tag dos guardanapos (guardanapo "sem tag" não tem)
const DTF_COPOS = [["PRODUCAO", "Em produção"], ["LOJA", "Em loja"]];
const DTF_COSTURA = [...DTF_COPOS, ["COSTUREIRO", "Com o costureiro"]];
const TAG_LOCAL = [["PRODUCAO", "Em produção"], ["LOJA", "Em loja"], ["COSTUREIRA", "Com a costureira"]];
const ehBolsaOuLeticia = p => (/^\s*bolsas?\b/i.test(p) && !/cartonad/i.test(p)) || /^\s*n[e]?cessaire\s+let[ií]cia/i.test(p);
const ehGloss = p => /^\s*(gloss|lip\s*b)/i.test(p);
const ehPulseiraLed = p => /pulseiras?\s+(de\s+)?led/i.test(p);
// Copo cuia e copo térmico (lançados em lembranças); "copo de leite" é flor e fica de fora
const ehCopoCuiaTermico = p => /^\s*copos?\b.*(cuia|t[eé]rmic)/i.test(p);
// Bastão de LED leva adesivo (não DTF), mesmo quando lançado em copos
const ehBastaoLed = p => /bast(ão|ao|ões|oes)\s+(de\s+)?led/i.test(p);
const opcoesDtf = i => {
  const p = i.produto || "";
  if (ehBastaoLed(p)) return null;
  if (i.cat === "COPOS" || ehCopoCuiaTermico(p) || ehGloss(p) || ehPulseiraLed(p)) return DTF_COPOS;
  return ehBolsaOuLeticia(p) ? DTF_COSTURA : null;
};
// Guardanapo (menos "sem tag") e caixa de acrílico (caixa, caixinha, cx…) têm a barra da tag
const ehCaixaAcrilico = p => /^\s*(adc\s+)?(caii?xa|caixinha|cx)s?\b.*acr/i.test(p);
const temTag = i => {
  const p = i.produto || "";
  if (/sem\s+tag/i.test(p)) return false;
  return /^\s*guardanapos?\b/i.test(p) || ehCaixaAcrilico(p);
};
// Menu provençal: se já está com o tassel
const TASSEL_LOCAL = [["COM", "Já está com tassel"], ["SEM", "Ainda sem tassel"]];
const temTassel = i => /\bmenu\b.*proven[cç]al/i.test(i.produto || "");
// Tags, bottons, aventais e óculos: se já foi solicitado ao cliente (nomes, fotos, arte…)
const SOLICITADO_LOCAL = [["SIM", "Sim, já solicitado"], ["NAO", "Ainda não"]];
const temSolicitado = i => /^\s*(tags?|bott?ons?|aventa(l|is))\b/i.test(i.produto || "") || /[oó]culos/i.test(i.produto || "");
// Guardanapos: se já estão separados em loja
const SEPARADO_LOCAL = [["SIM", "Sim, já separados"], ["NAO", "Ainda não"]];
const ehGuardanapo = i => /^\s*guardanapos?\b/i.test(i.produto || "");
// Barras embaixo do status: campo do item, rótulo, descrição para leitor de tela e opções (null = item não tem a barra)
const BARRAS = [
  { campo: "dtf", rotulo: "DTF", aria: "Onde está o DTF", opcoes: opcoesDtf },
  { campo: "tag", rotulo: "Tag", aria: "Onde está a tag", opcoes: i => temTag(i) ? TAG_LOCAL : null },
  { campo: "separado", rotulo: "Separados em loja", aria: "Guardanapos já separados em loja", opcoes: i => ehGuardanapo(i) ? SEPARADO_LOCAL : null },
  { campo: "tassel", rotulo: "Tassel", aria: "Tassel", opcoes: i => temTassel(i) ? TASSEL_LOCAL : null },
  { campo: "adesivo", rotulo: "Adesivo", aria: "Onde está o adesivo", opcoes: i => ehBastaoLed(i.produto || "") ? DTF_COPOS : null },
  { campo: "solicitado", rotulo: "Solicitado ao cliente", aria: "Já foi solicitado ao cliente", opcoes: i => temSolicitado(i) ? SOLICITADO_LOCAL : null },
];
function novoEstado(it, campo, valor) {
  const atual = { status: it.status, fornId: it.fornId, pedido: it.pedido || "", codigo: it.codigo || "", cores: it.cores || "", dtf: it.dtf || "", tag: it.tag || "", tassel: it.tassel || "", solicitado: it.solicitado || "", separado: it.separado || "", adesivo: it.adesivo || "", link: it.link || "" };
  const barra = BARRAS.find(b => b.campo === campo);
  if (barra) { if (valor && !(barra.opcoes(it) || []).some(([k]) => k === valor)) return null; return { ...atual, [campo]: valor || "" }; }
  if (campo === "forn") { if (valor && !SUP[valor]) return null; return { ...atual, fornId: valor || null }; }
  if (campo === "status") { if (!STATUS_LABEL[valor]) return null; return { ...atual, status: valor }; }
  if (campo === "pedido") {
    if (valor && !DATA_OK.test(valor)) return null;
    // Ao registrar o pedido, um item ainda "aguardando produção" passa para "repassado ao fornecedor"
    const status = valor && it.status === "AGUARDANDO_PRODUCAO" ? "REPASSADO" : it.status;
    return { ...atual, status, pedido: valor || "" };
  }
  if (campo === "codigo") {
    const v = String(valor || "").trim().replace(/\s+/g, " ");
    if (v.length > 40) return null;
    // Código do pedido = pedido feito: "aguardando produção" passa para "repassado"
    const status = v && it.status === "AGUARDANDO_PRODUCAO" ? "REPASSADO" : it.status;
    return { ...atual, status, codigo: v };
  }
  if (campo === "cores") {
    const v = String(valor || "").trim().replace(/\s+/g, " ");
    if (v.length > 200) return null;
    return { ...atual, cores: v };
  }
  if (campo === "link") {
    const v = String(valor || "").trim();
    if (v && !linkOk(v)) return null;
    return { ...atual, link: v };
  }
  return null;
}
// Só aceita endereço http(s) de verdade (nada de "javascript:" e afins)
function linkOk(v) {
  if (v.length > 500 || !/^https?:\/\//i.test(v)) return false;
  try { const u = new URL(v); return u.protocol === "https:" || u.protocol === "http:"; } catch (e) { return false; }
}
async function gravar(it, novo) {
  const { data, error } = await sb.from("itens").update({
    status: novo.status, fornecedor_id: novo.fornId || null, pedido_em: novo.pedido || null, codigo_pedido: novo.codigo || null, obs_cores: novo.cores || null,
    dtf_status: novo.dtf || null, tag_status: novo.tag || null, tassel_status: novo.tassel || null, solicitado_status: novo.solicitado || null, separado_status: novo.separado || null, adesivo_status: novo.adesivo || null, link_drive: novo.link || null,
    atualizado_em: new Date().toISOString(), atualizado_por: USER ? USER.id : null,
  }).eq("id", it.id).select("id");
  if (error) throw error;
  if (!data || !data.length) throw new Error("nada foi salvo");
  it.status = novo.status; it.fornId = novo.fornId || null; it.pedido = novo.pedido || ""; it.codigo = novo.codigo || ""; it.cores = novo.cores || "";
  it.dtf = novo.dtf || ""; it.tag = novo.tag || ""; it.tassel = novo.tassel || ""; it.solicitado = novo.solicitado || ""; it.separado = novo.separado || ""; it.adesivo = novo.adesivo || ""; it.link = novo.link || "";
}

async function salvarItem(itemId, campo, valor, tr) {
  const it = ITEM[itemId];
  if (!it || !LIVE || !SAFE_ID.test(itemId)) return;
  const novo = novoEstado(it, campo, valor);
  if (!novo) {
    if (campo === "link") { tr.dataset.lastCampo = "link"; rerender(itemId, "err", "não salvo: cole um link que comece com https://"); }
    return;
  }
  tr.classList.add("saving");
  tr.querySelectorAll("select, input").forEach(s => { s.disabled = true; });
  try {
    await gravar(it, novo);
    F.forEach(recalc);
    rerender(itemId, "ok", "salvo");
  } catch (e) {
    rerender(itemId, "err", erroDb(e));
  }
}

async function salvarLote(ids, campo, valor, progresso) {
  ids = ids.filter(id => ITEM[id] && SAFE_ID.test(id));
  if (!LIVE || !ids.length) return { ok: false, msg: "nada para salvar" };
  let n = 0, falha = null;
  for (const id of ids) {
    const it = ITEM[id];
    const novo = novoEstado(it, campo, valor);
    if (!novo) continue;
    try { await gravar(it, novo); n++; if (progresso) progresso(n, ids.length); }
    catch (e) { falha = e; break; }
  }
  F.forEach(recalc);
  return falha ? { ok: false, msg: `${n} salvos; o resto não: ${erroDb(falha)}` } : { ok: true, n };
}

/* ---------- Interface ---------- */
let atual = "agenda";
const abertos = new Set();
const byEv = id => F.filter(f => f.ev === id);
const sum = (arr, k) => arr.reduce((a, x) => a + x[k], 0);
const allItens = lista => lista.flatMap(f => f.itens);

// Meses abertos no menu (o resto fica recolhido); padrão: mês atual e o seguinte
const mesesAbertos = (() => {
  try { const s = JSON.parse(localStorage.getItem("mcm-meses-abertos") || "null"); if (Array.isArray(s)) return new Set(s); } catch (e) {}
  const d = new Date(), prox = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return new Set([`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, "0")}`]);
})();
const guardarMeses = () => { try { localStorage.setItem("mcm-meses-abertos", JSON.stringify([...mesesAbertos])); } catch (e) {} };

function renderFolders() {
  const nav = document.getElementById("folders");
  const tot = sum(F, "nEscolher");
  const hoje = hojeISO();
  const atrasadas = EVENTOS.filter(e => { const iso = isoDe(e); return iso && iso < hoje && byEv(e.id).some(f => f.itens.some(i => i.status !== "ENTREGUE")); }).length;
  const semana = EVENTOS.filter(e => { const iso = isoDe(e); return iso && iso >= hoje && diasAte(iso) <= 7; }).length;
  const items = [`<div class="nav-h">Dia a dia</div>`,
    `<button class="folder overview agenda" type="button" data-f="agenda" aria-current="${atual === "agenda"}">${calIcon}<span class="fn">Próximas entregas<span class="fd">o que vence primeiro</span></span><span class="fc">${semana ? `${semana} na semana` : ""}${atrasadas ? `<span class="w">${atrasadas} atrasada${atrasadas === 1 ? "" : "s"}</span>` : ""}</span></button>`,
    `<button class="folder overview novo" type="button" data-f="novo" aria-current="${atual === "novo"}">${plusIcon}<span class="fn">Novo pedido<span class="fd">lançar itens por setor</span></span><span class="fc">${Object.values(PEDIDOS).filter(p => !p.sync).length || ""}</span></button>`,
    `<button class="folder overview organizar" type="button" data-f="organizar" aria-current="${atual === "organizar"}">${sortIcon}<span class="fn">Organizar pedidos<span class="fd">por mês e turma</span></span><span class="fc">${EVENTOS.length}</span></button>`,
    `<button class="folder overview" type="button" data-f="geral" aria-current="${atual === "geral"}">${gridIcon}<span class="fn">Visão geral<span class="fd">todos os eventos</span></span><span class="fc">${F.length}${tot ? `<span class="w">${tot} a escolher</span>` : ""}</span></button>`,
    `<div class="nav-h">Controle</div>`,
    `<button class="folder overview lucro" type="button" data-f="lucro" aria-current="${atual === "lucro"}">${coinIcon}<span class="fn">Itens e lucro<span class="fd">venda × custo do fornecedor</span></span><span class="fc"></span></button>`,
    `<button class="folder overview" type="button" data-f="resumo" aria-current="${atual === "resumo"}">${listIcon}<span class="fn">Resumo do mês<span class="fd">cada item no mês</span></span><span class="fc"></span></button>`,
    `<button class="folder overview estoque" type="button" data-f="estoque" aria-current="${atual === "estoque"}">${cupIcon}<span class="fn">Estoque de copos<span class="fd">entradas, saídas e o que falta</span></span><span class="fc">${(n => n ? `<span class="w">${n} ${n === 1 ? "alerta" : "alertas"}</span>` : "")(nAlertasEstoque())}</span></button>`,
    `<button class="folder overview egeral" type="button" data-f="compras" aria-current="${atual === "compras"}">${boxIcon}<span class="fn">Estoque geral<span class="fd">estoque × pedidos: o que pedir</span></span><span class="fc">${(n => n ? `<span class="w">${n} a pedir</span>` : "")(linhasEstoqueGeral().filter(l => l.aPedir > 0).length)}</span></button>`];
  items.push(`<div class="nav-h">Turmas por mês</div>`);
  const porMes = {};
  EVENTOS.forEach(e => { (porMes[mesDe(e)] = porMes[mesDe(e)] || []).push(e); });
  Object.keys(porMes).sort().forEach(m => {
    const evs = porMes[m], aberto = mesesAbertos.has(m);
    const n = evs.reduce((a, e) => a + byEv(e.id).length, 0);
    items.push(`<button class="mes-h${aberto ? " on" : ""}${MES_SEL !== "todos" && MES_SEL !== m ? " off" : ""}" type="button" data-mes="${m}" aria-expanded="${aberto}"><span class="car" aria-hidden="true"></span>${esc(rotuloDe(m))}<span class="mes-n">${evs.length} turma${evs.length === 1 ? "" : "s"} · ${n}</span></button>`);
    if (!aberto) return;
    evs.forEach(e => {
      const l = byEv(e.id), w = sum(l, "nEscolher");
      items.push(`<button class="folder ev" type="button" data-f="${e.slug}" aria-current="${atual === e.slug}" title="${esc(e.nome)}">${folderIcon}<span class="fn"><span class="fnm">${esc(e.nome)}</span><span class="fd">${e.data ? e.data.slice(0, 5) + " · " : ""}${l.length} cliente${l.length === 1 ? "" : "s"}</span></span><span class="fc">${w ? `<span class="w" title="${w} itens com fornecedor a escolher">${w}</span>` : ""}</span></button>`);
    });
  });
  nav.innerHTML = items.join("");
  nav.querySelectorAll(".folder").forEach(b => b.addEventListener("click", () => abrir(b.dataset.f)));
  nav.querySelectorAll("[data-mes]").forEach(b => b.addEventListener("click", () => {
    const m = b.dataset.mes;
    if (mesesAbertos.has(m)) mesesAbertos.delete(m); else mesesAbertos.add(m);
    guardarMeses(); renderFolders();
  }));
}

function abrir(slug) {
  atual = slug;
  const ev = EVENTOS.find(e => e.slug === slug);
  if (ev && !mesesAbertos.has(mesDe(ev))) { mesesAbertos.add(mesDe(ev)); guardarMeses(); }
  try { history.replaceState(null, "", "#" + slug); } catch (e) {}
  renderFolders(); render();
  window.scrollTo({ top: 0 });
}

function statusResumo(lista) {
  const itens = allItens(lista).filter(i => PRODUCAO.has(i.cat));
  const n = itens.length || 1;
  const parts = STATUS.map(([k, l, c]) => [l, c, itens.filter(i => i.status === k).length]);
  return `<div class="panel"><h3>Produção</h3>
    <div class="stbar" role="img" aria-label="Status dos itens de produção">${parts.map(([l, c, q]) => q ? `<i style="width:${q / n * 100}%;background:${c}" title="${l}: ${q}"></i>` : "").join("")}</div>
    <div class="legend">${parts.map(([l, c, q]) => `<span><i style="background:${c}"></i>${l} <b class="num">${q}</b></span>`).join("")}</div>
    <p class="hint">Itens de papelaria, lembranças e copos (${int(itens.length)}). Doces e montagem não entram aqui.</p></div>`;
}

function kpis(lista) {
  const dev = sum(lista, "devido"), pago = sum(lista, "pago"), saldo = sum(lista, "saldo");
  const its = allItens(lista);
  const ent = its.filter(i => i.status === "ENTREGUE").length;
  return `<div class="kpis">
    <div class="kpi"><span class="eyebrow">Total</span><span class="v">${brl(dev)}</span><span class="s">${lista.length} formando${lista.length > 1 ? "s" : ""}</span></div>
    <div class="kpi"><span class="eyebrow">Recebido</span><span class="v">${brl(pago)}</span><span class="s">${dev ? Math.round(pago / dev * 100) : 0}% do total</span></div>
    <div class="kpi"><span class="eyebrow">Saldo</span><span class="v">${brl(saldo)}</span><span class="s">${lista.filter(f => f.saldo > 0).length} com saldo</span></div>
    <div class="kpi"><span class="eyebrow">Itens</span><span class="v">${int(its.length)}</span><span class="s">${int(ent)} entregue${ent === 1 ? "" : "s"}</span></div>
    <div class="kpi hl"><span class="eyebrow">Fornecedor a escolher</span><span class="v">${int(sum(lista, "nEscolher"))}</span><span class="s">escolha manual</span></div>
  </div>`;
}

function fornCell(i) {
  if (!LIVE) {
    const nome = i.fornId ? (SUP[i.fornId] || i.fornId) : null;
    return nome ? esc(nome) : i.escolher ? `<span class="chip warn">escolher</span>` : `<span class="forn-none">—</span>`;
  }
  const cand = candidatosDe(i.produto).filter(n => SUP_BY_NAME[n]);
  const outros = Object.entries(SUP).filter(([, n]) => !cand.includes(n)).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  const opt = (id, n) => `<option value="${esc(id)}"${id === i.fornId ? " selected" : ""}>${esc(n)}</option>`;
  const vazio = i.escolher ? "— escolher —" : "— sem fornecedor —";
  return `<select class="ed${i.escolher ? " need" : ""}" data-item="${esc(i.id)}" data-campo="forn" aria-label="Fornecedor de ${esc(i.produto)}">
    <option value=""${!i.fornId ? " selected" : ""}>${vazio}</option>
    ${cand.length ? `<optgroup label="Fornecedores deste produto">${cand.map(n => opt(SUP_BY_NAME[n], n)).join("")}</optgroup>` : ""}
    <optgroup label="${cand.length ? "Outros fornecedores" : "Fornecedores"}">${outros.map(([id, n]) => opt(id, n)).join("")}</optgroup>
  </select>`;
}
function statusCell(i) {
  if (!LIVE) return `<span class="chip st-${esc(i.status)}">${esc(STATUS_LABEL[i.status] || i.status)}</span>`;
  return `<select class="ed" data-st="${esc(i.status)}" data-item="${esc(i.id)}" data-campo="status" aria-label="Status de ${esc(i.produto)}">
    ${STATUS.map(([k, l]) => `<option value="${k}"${k === i.status ? " selected" : ""}>${l}</option>`).join("")}
    ${STATUS_LABEL[i.status] ? "" : `<option value="${esc(i.status)}" selected>${esc(i.status)}</option>`}
  </select>`;
}
// Barras embaixo do status (DTF, tag, tassel, solicitado ao cliente), cada uma com sua mensagem de "salvo"
function localCell(i, flash) {
  return BARRAS.map(({ campo, rotulo, aria, opcoes: deItem }) => {
    const opcoes = deItem(i);
    if (!opcoes) return "";
    const valor = i[campo] || "", nome = (opcoes.find(([k]) => k === valor) || [])[1];
    if (!LIVE) return nome ? `<span class="local-ro" data-local="${esc(valor)}">${rotulo}: ${esc(nome)}</span>` : "";
    return `<label class="local-l">${rotulo}<select class="ed local" data-local="${esc(valor)}" data-item="${esc(i.id)}" data-campo="${campo}" aria-label="${aria} de ${esc(i.produto)}">
    <option value="">— informar —</option>
    ${opcoes.map(([k, l]) => `<option value="${k}"${k === valor ? " selected" : ""}>${l}</option>`).join("")}
  </select></label>${flashEm(flash, campo)}`;
  }).join("");
}

function pedidoCell(i) {
  const comCodigo = ehImperio(i.fornId) || i.codigo;
  if (!LIVE) return (i.pedido ? `<span class="num">${fmtData(i.pedido)}</span>` : `<span class="forn-none">—</span>`) + (i.codigo ? `<span class="cod-ro">nº ${esc(i.codigo)}</span>` : "");
  return `<input type="date" class="ed dt${i.pedido ? " has" : ""}" data-item="${esc(i.id)}" data-campo="pedido" value="${esc(i.pedido || "")}" aria-label="Data do pedido ao fornecedor de ${esc(i.produto)}">`
    + (comCodigo ? `<input type="text" class="ed cod${i.codigo ? " has" : ""}" data-item="${esc(i.id)}" data-campo="codigo" value="${esc(i.codigo || "")}" maxlength="40" placeholder="nº pedido Império" aria-label="Código do pedido na Império de ${esc(i.produto)}">` : "");
}
// Mensagem de "salvo"/erro aparece embaixo do campo que foi alterado
const flashEm = (flash, campo) => {
  if (!flash) return "";
  const alvo = ["forn", "pedido", "codigo", "cores", "link", ...BARRAS.map(b => b.campo)].includes(flash[2]) ? flash[2] : "status";
  return alvo === campo ? `<span class="rowmsg ${flash[0]}">${esc(flash[1])}</span>` : "";
};
// ID visual, taxa de papelaria e vetorização têm o link do Drive com a arte
const temLink = produto => /id(entidade)?\s+visual|taxa\s+(de\s+)?(arte\s+de\s+)?papelaria|arte\s+(de\s+)?papelaria|vetor/i.test(produto || "");
// Observação geral + campo de cores (guardanapos e bolsas) + link do Drive (ID visual e taxas de arte)
function obsCell(i, flash) {
  const obs = String(i.obs || "").replace(/\s*\/?\s*BRINDE$/i, "").trim();
  const comCores = temCores(i.produto) || i.cores, comLink = temLink(i.produto) || i.link;
  if (!comCores && !comLink) return esc(obs);
  const cores = !comCores ? "" : !LIVE
    ? (i.cores ? `<span class="cores-ro"><b>Cores:</b> ${esc(i.cores)}</span>` : "")
    : `<input type="text" class="ed cores${i.cores ? " has" : ""}" data-item="${esc(i.id)}" data-campo="cores" value="${esc(i.cores || "")}" maxlength="200" placeholder="Cores: ex. azul marinho e dourado" aria-label="Cores de ${esc(i.produto)}">`;
  const abrir = i.link && linkOk(i.link) ? `<a class="drive-a" href="${esc(i.link)}" target="_blank" rel="noopener noreferrer">Abrir no Drive ↗</a>` : "";
  const link = !comLink ? "" : !LIVE ? abrir
    : `<input type="url" class="ed link${i.link ? " has" : ""}" data-item="${esc(i.id)}" data-campo="link" value="${esc(i.link || "")}" maxlength="500" placeholder="Link do Drive: https://drive.google.com/…" aria-label="Link do Drive de ${esc(i.produto)}">${abrir}`;
  return `${obs ? `<span class="obs-t">${esc(obs)}</span>` : ""}${cores}${flashEm(flash, "cores")}${link}${flashEm(flash, "link")}`;
}

function itemRow(i, flash) {
  const total = i.brinde ? `<span class="chip gift">brinde</span>` : i.vt == null ? `<span class="muted">a definir</span>` : brl(i.vt);
  return `<tr data-row="${esc(i.id)}"${flash ? ` class="flash-${flash[0]}"` : ""}>
    <td class="prod">${esc(i.produto)}</td>
    <td class="r num">${int(i.qtd)}</td>
    <td class="r num">${i.vu == null ? "—" : brl(i.vu)}</td>
    <td>${fornCell(i)}${flashEm(flash, "forn")}</td>
    <td>${pedidoCell(i)}${flashEm(flash, "pedido")}${flashEm(flash, "codigo")}</td>
    <td>${statusCell(i)}${flashEm(flash, "status")}${localCell(i, flash)}</td>
    <td class="r num">${total}</td>
    <td class="obs">${obsCell(i, flash)}</td>
  </tr>`;
}

function itemRows(f, filtro) {
  let itens = f.itens;
  if (filtro === "escolher") itens = itens.filter(i => i.escolher);
  if (STATUS_LABEL[filtro]) itens = itens.filter(i => i.status === filtro);
  if (!itens.length) return `<tr><td colspan="8" class="muted">Nenhum item com esse filtro.</td></tr>`;
  const out = [];
  CAT_ORDER.forEach(c => {
    const g = itens.filter(i => i.cat === c);
    if (!g.length) return;
    const sub = g.reduce((a, i) => a + (i.vt || 0), 0);
    out.push(`<tr class="grp"><td colspan="6">${CAT[c]} · ${g.length} ${g.length > 1 ? "itens" : "item"}</td><td class="r num">${brl(sub)}</td><td></td></tr>`);
    g.forEach(i => out.push(itemRow(i)));
    out.push(obsCatRow(f.id, c));
  });
  return out.join("");
}

// Observação final de cada categoria, embaixo dos itens dela na ficha do cliente
function obsCatRow(fo, c, msg) {
  const v = OBS_CAT[chaveObsCat(fo, c)] || "";
  if (!LIVE && !v) return "";
  const campo = !LIVE
    ? `<span class="obscat-ro">${esc(v)}</span>`
    : `<textarea class="obscat${v ? " has" : ""}" data-obscat="${esc(c)}" data-fo="${esc(fo)}" rows="${Math.min(6, Math.max(2, v.split("\n").length))}" maxlength="1000" placeholder="Observação final de ${esc(CAT[c].toLowerCase())}: cores, combinações, detalhes de entrega…" aria-label="Observação final de ${esc(CAT[c])}">${esc(v)}</textarea>`;
  return `<tr class="obs-cat" data-obscat-row="${esc(c)}"><td colspan="8"><div class="obscat-w"><span class="obscat-l">Observação final · ${CAT[c]}</span>${campo}${msg ? `<span class="rowmsg ${msg[0]}">${esc(msg[1])}</span>` : ""}</div></td></tr>`;
}
async function gravarObsCat(fo, c, valor) {
  const obs = String(valor || "").trim();
  if (obs.length > 1000) throw new Error("observação muito longa (máximo 1000 caracteres)");
  const q = obs
    ? sb.from("obs_categorias").upsert({ formando_id: fo, categoria: c, obs, atualizado_em: new Date().toISOString(), atualizado_por: USER ? USER.id : null }, { onConflict: "formando_id,categoria" })
    : sb.from("obs_categorias").delete().eq("formando_id", fo).eq("categoria", c);
  const { error } = await q;
  if (error) throw error;
  if (obs) OBS_CAT[chaveObsCat(fo, c)] = obs; else delete OBS_CAT[chaveObsCat(fo, c)];
}
async function salvarObsCat(el) {
  const fo = el.dataset.fo, c = el.dataset.obscat;
  if (!LIVE || !SAFE_ID.test(fo) || !CAT[c]) return;
  if (String(el.value).trim() === (OBS_CAT[chaveObsCat(fo, c)] || "")) return;
  const tr = el.closest("tr");
  el.disabled = true;
  let msg;
  try { await gravarObsCat(fo, c, el.value); msg = ["ok", "salvo"]; }
  catch (e) { msg = ["err", erroDb(e)]; }
  const tmp = document.createElement("tbody");
  tmp.innerHTML = obsCatRow(fo, c, msg);
  if (msg[0] === "err") tmp.querySelector("textarea").value = el.value;   // não perde o que foi digitado
  tr.replaceWith(tmp.firstElementChild);
}

// Para quem foi pago: sugestões a partir do que já foi lançado
const RECEB_PADRAO = ["MCM Formatura", "Pix ML", "Bradesco", "XP", "Cartão", "Dinheiro"];
function sugestoesRecebedor() {
  const s = new Set(RECEB_PADRAO);
  F.forEach(f => f.pg.forEach(p => { if (p.recebedor) s.add(p.recebedor); }));
  return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
function garantirListaRecebedor() {
  let dl = document.getElementById("dl-receb");
  if (!dl) { dl = document.createElement("datalist"); dl.id = "dl-receb"; document.body.appendChild(dl); }
  dl.innerHTML = sugestoesRecebedor().map(r => `<option value="${esc(r)}">`).join("");
}

function payList(f) {
  const lista = !f.pg.length ? `<p class="hint">Nenhum pagamento registrado.</p>` : `<ul>${f.pg.map((p, k) => {
    const chip = p.tipo === "DESCONTO" ? `<span class="chip gift">desconto</span>` : p.status === "PAGO" ? `<span class="chip ok">pago</span>` : `<span class="chip warn">a pagar</span>`;
    const para = p.recebedor ? ` <span class="pg-para">→ ${esc(p.recebedor)}</span>` : "";
    const acoes = LIVE && p.id != null ? `<span class="pg-acts">${p.status === "A_PAGAR" && p.tipo === "PARCELA" ? `<button class="btn x" type="button" data-pgpago="${k}" title="Marcar como pago hoje">pago</button>` : ""}<button class="btn x" type="button" data-pgdel="${k}" aria-label="Apagar pagamento" title="Apagar pagamento">×</button></span>` : "<span></span>";
    return `<li><span class="d">${esc(p.data || "sem data")}</span><span>${chip} ${esc(p.desc)}${para}${p.obs ? ` <span class="muted">· ${esc(p.obs)}</span>` : ""}</span><span class="v">${brl(p.valor)}</span>${acoes}</li>`;
  }).join("")}</ul>`;
  const form = !LIVE ? "" : `<form class="pg-form" data-pgform="${esc(f.id)}" novalidate>
    <div class="field"><label>Valor (R$)</label><input name="valor" inputmode="decimal" placeholder="0,00" required></div>
    <div class="field"><label>Data</label><input name="data" type="date" value="${hojeISO()}"></div>
    <div class="field pg-para-in"><label>Para quem foi pago</label><input name="recebedor" list="dl-receb" maxlength="80" placeholder="ex.: MCM Formatura, Pix ML"></div>
    <div class="field"><label>Situação</label><select name="tipo"><option value="PAGO">Pago</option><option value="A_PAGAR">A pagar (previsto)</option><option value="DESCONTO">Desconto</option></select></div>
    <div class="field pg-obs"><label>Observação</label><input name="obs" maxlength="140" placeholder="opcional"></div>
    <div class="pg-btn"><button class="btn primary" type="submit">Adicionar pagamento</button><span class="rowmsg" data-pgmsg role="status"></span></div>
  </form>`;
  return lista + form;
}

// Pagamentos: lançar, marcar como pago e apagar, direto na ficha do cliente
function redesenharPagamentos(f, msg, tipo) {
  recalc(f);
  const det = document.querySelector(`details.fo[data-id="${CSS.escape(f.id)}"]`);
  if (det) {
    det.querySelector(":scope > summary").innerHTML = foSummary(f, atual === "geral");
    const box = det.querySelector(".pays");
    box.innerHTML = `<h3>Pagamentos</h3>${payList(f)}
      <p class="hint">Total ${brl(f.total)}${f.desconto ? ` − desconto ${brl(f.desconto)}` : ""} · recebido ${brl(f.pago)} · saldo <b class="num">${brl(f.saldo)}</b></p>`;
    if (msg) { const m = box.querySelector("[data-pgmsg]"); if (m) { m.className = "rowmsg " + (tipo || "ok"); m.textContent = msg; } }
  }
  garantirListaRecebedor();
  refreshResumo();
}
// "1.234,56", "1234,56" ou "1234.56" -> 1234.56
const numBR = s => { s = String(s || "").trim().replace(/[R$\s]/g, ""); if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); const n = parseFloat(s); return isFinite(n) ? n : null; };
async function salvarPagamento(form) {
  const f = F.find(x => x.id === form.dataset.pgform), m = form.querySelector("[data-pgmsg]");
  if (!f || !LIVE) return;
  const erro = t => { m.className = "rowmsg err"; m.textContent = t; };
  const valor = arred(numBR(form.elements.valor.value) || 0);
  const iso = form.elements.data.value, sit = form.elements.tipo.value;
  const recebedor = form.elements.recebedor.value.trim().replace(/\s+/g, " "), obs = form.elements.obs.value.trim();
  if (!(valor > 0)) return erro("Informe um valor maior que zero.");
  if (iso && !DATA_OK.test(iso)) return erro("Data inválida.");
  if (sit === "PAGO" && !iso) return erro("Informe a data do pagamento.");
  const data = iso ? fmtData(iso) : null;
  const tipo = sit === "DESCONTO" ? "DESCONTO" : "PARCELA", status = sit === "A_PAGAR" ? "A_PAGAR" : "PAGO";
  const desc = tipo === "DESCONTO" ? "Desconto" : `${status === "PAGO" ? "Pago" : "A pagar"}${data ? " " + data.slice(0, 5) : ""}`;
  const ordem = f.pg.reduce((a, p) => Math.max(a, p.ordem || 0), 0) + 1;
  const btn = form.querySelector("button[type=submit]"); btn.disabled = true; m.className = "rowmsg"; m.textContent = "Salvando…";
  try {
    const { data: r, error } = await sb.from("pagamentos").insert({ formando_id: f.id, ordem, descricao: desc, valor, data, status, tipo, obs: obs || null, recebedor: recebedor || null }).select("id");
    if (error) throw error;
    if (!r || !r.length) throw new Error("nada foi salvo");
    f.pg.push({ id: r[0].id, ordem, desc, valor, data, status, tipo, obs, recebedor });
    redesenharPagamentos(f, `${tipo === "DESCONTO" ? "Desconto" : "Pagamento"} de ${brl(valor)} lançado.`);
  } catch (err) { btn.disabled = false; erro(erroDb(err)); }
}
async function acaoPagamento(btn) {
  const det = btn.closest("details.fo"), f = det && F.find(x => x.id === det.dataset.id);
  if (!f || !LIVE) return;
  const apagar = btn.dataset.pgdel != null, k = +(apagar ? btn.dataset.pgdel : btn.dataset.pgpago), p = f.pg[k];
  if (!p || p.id == null) return;
  if (apagar && btn.dataset.conf !== "1") { btn.dataset.conf = "1"; btn.textContent = "apagar?"; btn.classList.add("bad"); return; }
  btn.disabled = true;
  try {
    if (apagar) {
      const { data, error } = await sb.from("pagamentos").delete().eq("id", p.id).select("id");
      if (error) throw error;
      if (!data || !data.length) throw new Error("nada foi salvo");
      f.pg.splice(k, 1);
      redesenharPagamentos(f, "Pagamento apagado.");
    } else {
      const data = fmtData(hojeISO()), desc = `Pago ${data.slice(0, 5)}`;
      const { data: r, error } = await sb.from("pagamentos").update({ status: "PAGO", data, descricao: desc }).eq("id", p.id).select("id");
      if (error) throw error;
      if (!r || !r.length) throw new Error("nada foi salvo");
      Object.assign(p, { status: "PAGO", data, desc });
      redesenharPagamentos(f, `${brl(p.valor)} marcado como pago hoje.`);
    }
  } catch (err) { btn.disabled = false; redesenharPagamentos(f, erroDb(err), "err"); }
}

function foSummary(f, mostraEvento) {
  const pct = f.devido ? Math.min(1, f.pago / f.devido) : 1;
  const prod = f.itens.filter(i => PRODUCAO.has(i.cat));
  const prontos = prod.filter(i => i.status === "PRONTO" || i.status === "ENTREGUE").length;
  const chips = [];
  if (f.saldo === 0) chips.push(`<span class="chip ok">quitado</span>`);
  else if (f.pago === 0) chips.push(`<span class="chip bad">nada recebido</span>`);
  if (f.nEscolher) chips.push(`<span class="chip warn">${f.nEscolher} a escolher</span>`);
  const ev = EVENTOS.find(e => e.id === f.ev);
  return `<span class="car" aria-hidden="true"></span>
    <span><span class="who">${esc(f.nome)}</span><br><span class="sub">${f.itens.length} itens${mostraEvento && ev ? ` · ${esc(ev.nome)} ${ev.data.slice(0, 5)}` : ""}</span></span>
    <span class="cell"><span class="l">Total</span><span class="v">${brl(f.devido)}</span></span>
    <span class="cell"><span class="l">Recebido</span><span class="v">${brl(f.pago)}</span><span class="bar" aria-hidden="true"><i style="width:${(pct * 100).toFixed(1)}%"></i></span></span>
    <span class="cell"><span class="l">Produção pronta</span><span class="v">${prontos}/${prod.length}</span></span>
    <span class="chips">${chips.join("")}</span>`;
}

function foCard(f, filtro, mostraEvento) {
  return `<details class="fo" data-id="${esc(f.id)}"${abertos.has(f.id) ? " open" : ""}>
    <summary>${foSummary(f, mostraEvento)}</summary>
    <div class="body">
      <div class="tablebox"><table>
        <thead><tr><th>Item</th><th class="r">Qtd</th><th class="r">Valor un.</th><th>Fornecedor</th><th>Pedido ao fornecedor</th><th>Status</th><th class="r">Total</th><th>Observação</th></tr></thead>
        <tbody>${itemRows(f, filtro)}</tbody>
      </table></div>
      <div class="pays"><h3>Pagamentos</h3>${payList(f)}
        <p class="hint">Total ${brl(f.total)}${f.desconto ? ` − desconto ${brl(f.desconto)}` : ""} · recebido ${brl(f.pago)} · saldo <b class="num">${brl(f.saldo)}</b></p>
      </div>
    </div>
  </details>`;
}

// Depois de salvar: troca só a linha e o resumo do formando, sem fechar nada
function rerender(itemId, kind, text) {
  const it = ITEM[itemId];
  const tr = document.querySelector(`tr[data-row="${CSS.escape(itemId)}"]`);
  const campo = tr && tr.dataset.lastCampo;
  if (tr) {
    const tmp = document.createElement("tbody");
    tmp.innerHTML = tr.dataset.view === "prod" ? prodRow(it, [kind, text, campo]) : itemRow(it, [kind, text, campo]);
    tr.replaceWith(tmp.firstElementChild);
  }
  const f = F.find(x => x.id === it.fo);
  const det = document.querySelector(`details.fo[data-id="${CSS.escape(f.id)}"] > summary`);
  if (det) det.innerHTML = foSummary(f, atual === "geral");
  refreshResumo();
}

function refreshResumo() {
  if (atual === "resumo") { renderFolders(); return; }
  if (atual === "novo") { renderFolders(); renderNovoLista(); return; }
  if (atual === "lucro" || atual === "estoque" || atual === "compras" || atual === "organizar") { renderFolders(); return; }
  if (atual === "agenda") { renderFolders(); renderAgenda(); return; }
  const k = document.querySelector(".kpis");
  const evAtual = EVENTOS.find(x => x.slug === atual);
  if (k && (atual === "geral" || evAtual)) {
    const lista = atual === "geral" ? FMes() : byEv(evAtual.id);
    k.outerHTML = kpis(lista);
    const st = document.getElementById("stpanel");
    if (st) st.innerHTML = statusResumo(lista);
  }
  renderFolders();
}

function filtrar(lista, q, sit) {
  let r = lista;
  if (q) r = r.filter(f => f.nome.toLowerCase().includes(q) || f.itens.some(i => i.produto.toLowerCase().includes(q) || (SUP[i.fornId] || "").toLowerCase().includes(q)));
  if (sit === "open") r = r.filter(f => f.saldo > 0);
  if (sit === "zero") r = r.filter(f => f.pago === 0);
  if (sit === "paid") r = r.filter(f => f.saldo === 0);
  if (sit === "escolher") r = r.filter(f => f.nEscolher > 0);
  if (STATUS_LABEL[sit]) r = r.filter(f => f.itens.some(i => i.status === sit));
  return r;
}

const toolsHtml = ph => `<div class="tools">
  <input id="q" type="search" placeholder="${ph}" aria-label="Buscar">
  <select id="sit" aria-label="Filtro">
    <option value="all">Todos os formandos</option>
    <option value="escolher">Com fornecedor a escolher</option>
    <optgroup label="Com itens no status">${STATUS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</optgroup>
    <optgroup label="Pagamento"><option value="open">Com saldo a receber</option><option value="zero">Nada recebido ainda</option><option value="paid">Quitados</option></optgroup>
  </select>
  <button class="btn" type="button" id="expand">Abrir todos</button>
  <button class="btn" type="button" id="collapse">Fechar todos</button>
</div>`;

function render() {
  const main = document.getElementById("main");
  if (atual === "resumo") { renderResumo(); return; }
  if (atual === "novo") { renderNovo(); return; }
  if (atual === "lucro") { renderLucro(); return; }
  if (atual === "estoque") { renderEstoque(); return; }
  if (atual === "compras") { renderEstoqueGeral(); return; }
  if (atual === "organizar") { renderOrganizar(); return; }
  if (atual === "agenda") { renderAgenda(); return; }
  if (atual !== "geral" && !EVENTOS.some(x => x.slug === atual)) atual = "geral";
  if (atual === "geral") {
    const grupos = {};
    allItens(FMes()).filter(i => i.escolher).forEach(i => {
      const p = i.produto.toLowerCase();
      const g = /identidade visual|id visual|^id$|taxa.*(id|papelaria|arte)|vetoriza/.test(p) ? "Arte / ID visual"
        : /guardanapo/.test(p) ? "Guardanapos" : /necessaire|ncessaire|mini hel/.test(p) ? "Necessaires"
        : /bolsa/.test(p) ? "Bolsas" : /gloss|lip ?b/.test(p) ? "Gloss / lip balm" : /cartonad/.test(p) ? "Caixa cartonada"
        : /avental/.test(p) ? "Aventais" : "Fora do catálogo";
      grupos[g] = (grupos[g] || 0) + 1;
    });
    const esq = Object.entries(grupos).sort((a, b) => b[1] - a[1]);
    const maxE = Math.max(1, ...esq.map(x => x[1]));
    main.innerHTML = `
      <div class="evhead"><span class="eyebrow">Visão geral · ${esc(rotuloMes())}</span><h2>${MES_SEL === "todos" ? "Todos os eventos" : "Eventos de " + esc(rotuloMes().toLowerCase())}</h2></div>
      ${kpis(FMes())}
      <div class="evcards">${EVMes().map(e => {
        const l = byEv(e.id), d = sum(l, "devido"), p = sum(l, "pago"), w = sum(l, "nEscolher");
        return `<button class="evcard" type="button" data-f="${e.slug}">
          <span class="meta"><span class="nm">${esc(e.nome)}</span><span class="dt">${e.data.slice(0, 5)}</span></span>
          <span class="bar" aria-hidden="true"><i style="width:${d ? (p / d * 100).toFixed(1) : 0}%"></i></span>
          <span class="meta"><span>${l.length} formando${l.length > 1 ? "s" : ""} · ${allItens(l).length} itens</span><span class="num">${d ? Math.round(p / d * 100) : 0}% recebido</span></span>
          ${w ? `<span class="meta"><span class="chip warn">${w} a escolher</span></span>` : ""}
        </button>`;
      }).join("")}</div>
      <div class="two">
        <div id="stpanel">${statusResumo(FMes())}</div>
        <div class="panel"><h3>Fornecedor a escolher</h3>
          <div class="rows">${esq.length ? esq.map(([g, n]) => `<div class="row"><span class="lab">${g}</span><span class="val">${n} itens</span><div class="bar" aria-hidden="true"><i style="width:${(n / maxE * 100).toFixed(1)}%"></i></div></div>`).join("") : `<p class="hint">Todos os itens de produção já têm fornecedor.</p>`}</div></div>
      </div>
      ${tabsHtml()}
      <div class="tabbody" id="tabbody"></div>`;
    main.querySelectorAll(".evcard").forEach(b => b.addEventListener("click", () => abrir(b.dataset.f)));
  } else {
    const e = EVENTOS.find(x => x.slug === atual);
    const lista = byEv(e.id);
    main.innerHTML = `
      <div class="evhead"><span class="eyebrow">Pasta do evento</span><h2>${esc(e.nome)}</h2><span class="date">${e.data}</span></div>
      ${kpis(lista)}
      <div id="stpanel">${statusResumo(lista)}</div>
      ${tabsHtml()}
      <div class="tabbody" id="tabbody"></div>`;
  }
  main.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => {
    aba = b.dataset.aba; sel.clear();
    main.querySelectorAll(".tab").forEach(x => x.setAttribute("aria-selected", String(x === b)));
    renderTab();
  }));
  renderTab();
}

/* ---------- Novo pedido: lançamento por setor ---------- */
const SETORES = ["PAPELARIA", "LEMBRANCAS", "COPOS", "DOCES", "MONTAGEM"];
const linhaVazia = () => ({ produto: "", qtd: "", vu: "", fornId: "", obs: "" });
const novoRascunho = (evId = "") => ({ evId, evNome: "", evData: "", foNome: "", linhas: Object.fromEntries(SETORES.map(c => [c, [linhaVazia()]])), obsCat: {} });
let RASC = (() => {
  try { const r = JSON.parse(localStorage.getItem("mcm-rascunho-pedido") || "null"); if (r && r.linhas) return r; } catch (e) {}
  return novoRascunho();
})();
const guardarRascunho = () => { try { localStorage.setItem("mcm-rascunho-pedido", JSON.stringify(RASC)); } catch (e) {} };
const num = v => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : null; };
const arred = v => Math.round(v * 100) / 100;

// Sugestões de produto e preço por setor, tiradas dos orçamentos que já estão no painel
function sugestoes() {
  const s = {};
  SETORES.forEach(c => { s[c] = {}; });
  Object.values(ITEM).forEach(i => {
    if (!s[i.cat]) return;
    const nome = canon(i.produto);
    (s[i.cat][nome] = s[i.cat][nome] || []).push(i.vu);
  });
  const out = {};
  SETORES.forEach(c => {
    out[c] = Object.entries(s[c]).map(([nome, vs]) => {
      const v = vs.filter(x => x != null).sort((a, b) => a - b);
      const tab = (CUSTOS[chaveProduto(nome)] || {}).venda;
      return { nome, preco: tab != null ? +tab : v.length ? v[Math.floor(v.length / 2)] : null, n: vs.length };
    }).sort((a, b) => b.n - a.n);
  });
  return out;
}
let SUGEST = null;

function fornOptions(produto, sel) {
  const cand = candidatosDe(produto || "").filter(n => SUP_BY_NAME[n]);
  const outros = Object.entries(SUP).filter(([, n]) => !cand.includes(n)).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  const opt = (id, n) => `<option value="${esc(id)}"${id === sel ? " selected" : ""}>${esc(n)}</option>`;
  return `<option value="">— definir depois —</option>
    ${cand.length ? `<optgroup label="Fornecedores deste produto">${cand.map(n => opt(SUP_BY_NAME[n], n)).join("")}</optgroup>` : ""}
    <optgroup label="${cand.length ? "Outros fornecedores" : "Fornecedores"}">${outros.map(([id, n]) => opt(id, n)).join("")}</optgroup>`;
}

function linhaHtml(c, k, l) {
  const q = num(l.qtd), v = num(l.vu);
  const tot = q != null && v != null ? brl(arred(q * v)) : "—";
  return `<tr data-cat="${c}" data-k="${k}">
    <td><input class="np-in" data-f="produto" list="dl_${c}" value="${esc(l.produto)}" placeholder="Produto" aria-label="Produto (${CAT[c]})"${LIVE ? "" : " disabled"}></td>
    <td><input class="np-in r" data-f="qtd" type="number" inputmode="numeric" min="0" step="1" value="${esc(l.qtd)}" aria-label="Quantidade"${LIVE ? "" : " disabled"}></td>
    <td><input class="np-in r" data-f="vu" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(l.vu)}" placeholder="0,00" aria-label="Valor unitário"${LIVE ? "" : " disabled"}></td>
    <td class="r num" data-tot>${tot}</td>
    <td><select class="np-in" data-f="fornId" aria-label="Fornecedor"${LIVE ? "" : " disabled"}>${fornOptions(l.produto, l.fornId)}</select></td>
    <td><input class="np-in" data-f="obs" value="${esc(l.obs)}" placeholder="Modelo, cor, sabores…" aria-label="Observação"${LIVE ? "" : " disabled"}></td>
    <td><button type="button" class="btn x" data-del aria-label="Remover linha"${LIVE ? "" : " disabled"}>×</button></td>
  </tr>`;
}

function setorHtml(c) {
  return `<section class="panel np-setor" data-cat="${c}">
    <div class="np-sh"><h3>${CAT[c]}</h3><span class="num" id="sub_${c}"></span></div>
    <div class="tablebox"><table class="np-t">
      <thead><tr><th>Produto</th><th class="r">Qtd</th><th class="r">Valor un.</th><th class="r">Total</th><th>Fornecedor</th><th>Observação</th><th><span class="sr">Remover</span></th></tr></thead>
      <tbody id="rows_${c}">${RASC.linhas[c].map((l, k) => linhaHtml(c, k, l)).join("")}</tbody>
    </table></div>
    <div><button type="button" class="btn" data-add="${c}"${LIVE ? "" : " disabled"}>+ Adicionar item de ${CAT[c].toLowerCase()}</button></div>
    <div class="field np-obscat"><label for="obscat_${c}">Observação final de ${CAT[c].toLowerCase()}</label><textarea id="obscat_${c}" data-np-obscat="${c}" rows="2" maxlength="1000" placeholder="Cores, combinações, detalhes de entrega…"${LIVE ? "" : " disabled"}>${esc((RASC.obsCat || {})[c] || "")}</textarea></div>
    <datalist id="dl_${c}">${(SUGEST[c] || []).map(s => `<option value="${esc(s.nome)}">${s.preco != null ? esc(brl(s.preco)) : ""}</option>`).join("")}</datalist>
  </section>`;
}

function renderNovo() {
  SUGEST = sugestoes();
  const main = document.getElementById("main");
  main.innerHTML = `
    <div class="evhead"><span class="eyebrow">Novo pedido</span><h2>Lançar pedido novo</h2>
      <p class="hint">Escolha o evento e o formando, preencha os itens em cada setor e salve. O pedido entra na pasta do evento com status "Aguardando produção". Setores sem itens são ignorados.</p></div>
    ${LIVE ? "" : `<div class="callout ro">Somente leitura: o lançamento de pedidos não está disponível nesta visualização. Veja o motivo na faixa do topo.</div>`}
    <form id="npform" class="np" novalidate>
      <div class="panel np-head">
        <div class="field"><label for="npev">Evento</label>
          <select id="npev"${LIVE ? "" : " disabled"}><option value="">Escolha o evento</option>
            ${EVENTOS.map(e => `<option value="${esc(e.id)}"${RASC.evId === e.id ? " selected" : ""}>${esc(e.nome)} · ${esc(e.data.slice(0, 5))}</option>`).join("")}
            <option value="__novo"${RASC.evId === "__novo" ? " selected" : ""}>+ Novo evento…</option>
          </select></div>
        <div class="field" id="npevnovo"${RASC.evId === "__novo" ? "" : " hidden"}>
          <label for="npevnome">Nome do novo evento</label><input id="npevnome" value="${esc(RASC.evNome)}" placeholder="Ex.: Pré Lourdinas">
          <label for="npevdata">Data do evento</label><input id="npevdata" type="date" value="${esc(RASC.evData)}"></div>
        <div class="field"><label for="npfo">Formando</label>
          <input id="npfo" list="npfolist" value="${esc(RASC.foNome)}" placeholder="Nome do formando" autocomplete="off"${LIVE ? "" : " disabled"}>
          <datalist id="npfolist"></datalist><span class="hint" id="npfohint"></span></div>
      </div>
      ${SETORES.map(setorHtml).join("")}
      <div class="panel np-foot">
        <div><span class="eyebrow">Total do pedido</span><div class="np-total num" id="nptotal">R$ 0,00</div><span class="hint" id="npcount"></span></div>
        <div class="np-actions">
          <button type="button" class="btn" id="npclear"${LIVE ? "" : " disabled"}>Limpar formulário</button>
          <button type="submit" class="btn primary" id="npsave"${LIVE ? "" : " disabled"}>Salvar pedido</button>
        </div>
        <p class="np-msg" id="npmsg" role="status"></p>
      </div>
    </form>
    <section class="np-list"><div class="sechead"><h3>Pedidos lançados no painel</h3></div><div id="nplist"></div></section>`;
  wireNovo();
  renderNovoLista();
}

function formandoExistente(evId, nome) {
  const n = semAcento(nome);
  if (!n || !evId || evId === "__novo") return null;
  return F.find(f => f.ev === evId && semAcento(f.nome) === n) || null;
}

function atualizarTotais() {
  let total = 0, n = 0;
  SETORES.forEach(c => {
    let sub = 0, m = 0;
    RASC.linhas[c].forEach(l => { const q = num(l.qtd), v = num(l.vu); if (l.produto.trim() && q) { m++; if (v != null) sub += q * v; } });
    total += sub; n += m;
    const el = document.getElementById("sub_" + c);
    if (el) el.textContent = m ? `${m} ${m > 1 ? "itens" : "item"} · ${brl(arred(sub))}` : "";
  });
  const t = document.getElementById("nptotal"); if (t) t.textContent = brl(arred(total));
  const ct = document.getElementById("npcount"); if (ct) ct.textContent = n ? `${n} ${n > 1 ? "itens preenchidos" : "item preenchido"}` : "Nenhum item preenchido ainda";
}

function atualizarFormando() {
  const evId = RASC.evId;
  const dl = document.getElementById("npfolist"), hint = document.getElementById("npfohint");
  if (!dl) return;
  dl.innerHTML = evId && evId !== "__novo" ? byEv(evId).map(f => `<option value="${esc(f.nome)}"></option>`).join("") : "";
  const ex = formandoExistente(evId, RASC.foNome);
  hint.textContent = !RASC.foNome.trim() ? "" : ex ? "Já existe neste evento: os itens serão somados ao orçamento dele." : "Formando novo neste evento.";
}

function wireNovo() {
  const form = document.getElementById("npform");
  const ev = document.getElementById("npev");
  ev.addEventListener("change", () => {
    RASC.evId = ev.value;
    document.getElementById("npevnovo").hidden = ev.value !== "__novo";
    guardarRascunho(); atualizarFormando();
  });
  ["npevnome", "npevdata"].forEach(id => document.getElementById(id).addEventListener("input", e => {
    RASC[id === "npevnome" ? "evNome" : "evData"] = e.target.value; guardarRascunho();
  }));
  document.getElementById("npfo").addEventListener("input", e => { RASC.foNome = e.target.value; guardarRascunho(); atualizarFormando(); });

  form.addEventListener("input", e => {
    const oc = e.target.closest("textarea[data-np-obscat]");
    if (oc) { (RASC.obsCat = RASC.obsCat || {})[oc.dataset.npObscat] = oc.value; guardarRascunho(); return; }
    const inp = e.target.closest("tr[data-cat] .np-in");
    if (!inp) return;
    const tr = inp.closest("tr"), c = tr.dataset.cat, k = +tr.dataset.k;
    RASC.linhas[c][k][inp.dataset.f] = inp.value;
    const l = RASC.linhas[c][k], q = num(l.qtd), v = num(l.vu);
    tr.querySelector("[data-tot]").textContent = q != null && v != null ? brl(arred(q * v)) : "—";
    guardarRascunho(); atualizarTotais();
  });
  form.addEventListener("change", e => {
    const inp = e.target.closest('tr[data-cat] input[data-f="produto"]');
    if (!inp) return;
    const tr = inp.closest("tr"), c = tr.dataset.cat, k = +tr.dataset.k, l = RASC.linhas[c][k];
    // Ao escolher um produto conhecido: sugere o preço mais comum e os fornecedores dele
    const s = (SUGEST[c] || []).find(x => x.nome === l.produto);
    if (s && s.preco != null && !String(l.vu).trim()) { l.vu = String(s.preco); tr.querySelector('[data-f="vu"]').value = l.vu; }
    tr.querySelector('[data-f="fornId"]').innerHTML = fornOptions(l.produto, l.fornId);
    const q = num(l.qtd), v = num(l.vu);
    tr.querySelector("[data-tot]").textContent = q != null && v != null ? brl(arred(q * v)) : "—";
    guardarRascunho(); atualizarTotais();
  });
  form.addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    if (add) {
      const c = add.dataset.add;
      RASC.linhas[c].push(linhaVazia());
      const k = RASC.linhas[c].length - 1;
      document.getElementById("rows_" + c).insertAdjacentHTML("beforeend", linhaHtml(c, k, RASC.linhas[c][k]));
      document.querySelector(`tr[data-cat="${c}"][data-k="${k}"] input`).focus();
      guardarRascunho(); return;
    }
    const del = e.target.closest("[data-del]");
    if (del) {
      const tr = del.closest("tr"), c = tr.dataset.cat;
      RASC.linhas[c].splice(+tr.dataset.k, 1);
      if (!RASC.linhas[c].length) RASC.linhas[c].push(linhaVazia());
      document.getElementById("rows_" + c).innerHTML = RASC.linhas[c].map((l, k) => linhaHtml(c, k, l)).join("");
      guardarRascunho(); atualizarTotais();
    }
  });
  const clear = document.getElementById("npclear");
  clear.addEventListener("click", () => {
    if (clear.dataset.confirm !== "1") { clear.dataset.confirm = "1"; clear.textContent = "Confirmar: limpar tudo"; setTimeout(() => { clear.dataset.confirm = ""; clear.textContent = "Limpar formulário"; }, 4000); return; }
    RASC = novoRascunho(RASC.evId); guardarRascunho(); renderNovo();
  });
  form.addEventListener("submit", e => { e.preventDefault(); salvarPedido(); });
  atualizarFormando(); atualizarTotais();
}


async function salvarPedido() {
  const msg = document.getElementById("npmsg"), btn = document.getElementById("npsave");
  const erro = t => { msg.className = "np-msg err"; msg.textContent = t; };
  if (!LIVE) return erro("Os dados ainda não carregaram. Espere a faixa do topo ficar verde.");
  let evento;
  if (RASC.evId === "__novo") {
    const nome = RASC.evNome.trim();
    if (!nome) return erro("Digite o nome do novo evento.");
    const ja = EVENTOS.find(e => semAcento(e.nome) === semAcento(nome));
    evento = ja ? { id: ja.id, nome: ja.nome } : { id: "", nome, data: DATA_OK.test(RASC.evData) ? RASC.evData : "" };
  } else {
    const ev = EVENTOS.find(e => e.id === RASC.evId);
    if (!ev) return erro("Escolha o evento do pedido.");
    evento = { id: ev.id, nome: ev.nome };
  }
  const foNome = RASC.foNome.trim();
  if (!foNome) return erro("Digite o nome do formando.");
  const itens = [];
  for (const c of SETORES) {
    for (const l of RASC.linhas[c]) {
      const produto = l.produto.trim();
      if (!produto && !String(l.qtd).trim() && !String(l.vu).trim()) continue;
      const q = num(l.qtd), v = num(l.vu);
      if (!produto) return erro(`Falta o nome do produto em uma linha de ${CAT[c]}.`);
      if (!q || q < 0) return erro(`Falta a quantidade de "${produto}" (${CAT[c]}).`);
      itens.push({ produto, cat: c, qtd: Math.round(q), vu: v, vt: v != null ? arred(q * v) : null, fornId: SUP[l.fornId] ? l.fornId : "", obs: l.obs.trim() });
    }
  }
  if (!itens.length) return erro("Preencha pelo menos um item.");
  const ex = formandoExistente(evento.id, foNome);
  const doc = { evento, formando: ex ? { id: ex.id, nome: ex.nome } : { nome: foNome }, itens };
  const total = arred(itens.reduce((a, i) => a + (i.vt || 0), 0));
  btn.disabled = true; msg.className = "np-msg"; msg.textContent = "Salvando pedido…";
  try {
    const { data: pid, error } = await sb.rpc("criar_pedido", { p: doc });
    if (error) throw error;
    await carregar();
    // Observação final de cada setor com itens: vai para a ficha do cliente (somada à que já existia)
    const foId = PEDIDOS[pid] && PEDIDOS[pid].itens.length ? PEDIDOS[pid].itens[0].fo : null;
    let avisoObs = "";
    if (foId) {
      for (const c of SETORES) {
        const nova = String((RASC.obsCat || {})[c] || "").trim();
        if (!nova || !itens.some(i => i.cat === c)) continue;
        const antes = OBS_CAT[chaveObsCat(foId, c)] || "";
        try { await gravarObsCat(foId, c, antes ? `${antes}\n${nova}` : nova); }
        catch (e) { avisoObs += ` A observação final de ${CAT[c].toLowerCase()} não foi salva (${erroDb(e)}): escreva de novo na ficha do cliente.`; }
      }
    }
    const evId = PEDIDOS[pid] && PEDIDOS[pid].evento.id ? PEDIDOS[pid].evento.id : evento.id;
    const evSlug = (EVENTOS.find(e => e.id === evId) || {}).slug;
    RASC = novoRascunho(evId || ""); guardarRascunho();
    renderFolders(); renderNovo();
    const m = document.getElementById("npmsg");
    m.className = avisoObs ? "np-msg err" : "np-msg ok";
    m.innerHTML = `Pedido salvo: ${itens.length} ${itens.length > 1 ? "itens" : "item"} para <b>${esc(foNome)}</b> (${esc(evento.nome)}), ${brl(total)}.${esc(avisoObs)} ${evSlug ? `<button type="button" class="btn" id="npver">Abrir a pasta do evento</button>` : ""}`;
    const ver = document.getElementById("npver");
    if (ver) ver.addEventListener("click", () => { aba = "formandos"; abrir(evSlug); });
  } catch (e) {
    btn.disabled = false;
    erro("O pedido não foi salvo: " + erroDb(e) + ". O formulário continua preenchido.");
  }
}

function renderNovoLista() {
  const box = document.getElementById("nplist");
  if (!box) return;
  const l = Object.entries(PEDIDOS).sort((a, b) => String(b[1].criadoEm).localeCompare(String(a[1].criadoEm)));
  if (!l.length) { box.innerHTML = `<div class="empty">Nenhum pedido lançado pelo painel ainda. Os pedidos salvos aparecem aqui e na pasta do evento.</div>`; return; }
  box.innerHTML = `<div class="tablebox"><table class="np-t">
    <thead><tr><th>Lançado em</th><th>Formando</th><th>Evento</th><th class="r">Itens</th><th class="r">Total</th><th></th></tr></thead>
    <tbody>${l.map(([pid, p]) => {
      const quando = p.criadoEm ? new Date(p.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
      const setores = SETORES.filter(c => (p.itens || []).some(i => i.cat === c)).map(c => CAT[c]).join(", ");
      return `<tr><td class="num">${esc(quando)}</td><td class="fo-n">${esc((p.formando || {}).nome)}${(p.formando || {}).id ? `<span class="sub">somado ao orçamento existente</span>` : `<span class="sub">formando novo</span>`}</td>
        <td>${esc((p.evento || {}).nome)}</td><td class="r num">${(p.itens || []).length}<span class="sub">${esc(setores)}</span></td><td class="r num">${brl(p.total || 0)}</td>
        <td>${LIVE ? `<button type="button" class="btn" data-delped="${esc(pid)}">Excluir</button>` : ""}</td></tr>`;
    }).join("")}</tbody></table></div>`;
  box.querySelectorAll("[data-delped]").forEach(b => b.addEventListener("click", async () => {
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirmar exclusão"; setTimeout(() => { if (b.isConnected) { b.dataset.confirm = ""; b.textContent = "Excluir"; } }, 4000); return; }
    b.disabled = true; b.textContent = "Excluindo…";
    try {
      const { error } = await sb.rpc("excluir_pedido", { pid: b.dataset.delped });
      if (error) throw error;
      await carregar();
      renderFolders(); renderNovoLista();
    } catch (e) { b.disabled = false; b.textContent = "Não excluiu: " + erroDb(e); }
  }));
}

/* ---------- Itens e lucro: preço de venda × custo do fornecedor ---------- */
const CUSTOS = {};          // chave do produto -> { produto, custo, venda, em }
const chaveProduto = nome => semAcento(nome).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "item";
const pct = v => (v == null || !isFinite(v)) ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function linhasLucro() {
  return agruparMes().map(g => {
    const k = chaveProduto(g.nome), c = CUSTOS[k] || {};
    const vendidos = g.itens.filter(i => !i.brinde && i.vt != null);
    const qVend = vendidos.reduce((a, i) => a + (i.qtd || 0), 0);
    const receita = vendidos.reduce((a, i) => a + (i.vt || 0), 0);
    const qBrinde = g.itens.filter(i => i.brinde).reduce((a, i) => a + (i.qtd || 0), 0);
    const semValor = g.itens.filter(i => !i.brinde && i.vt == null).length;
    const custoUn = c.custo == null || c.custo === "" ? null : +c.custo;
    const custoTot = custoUn == null ? null : arred(custoUn * g.qtd);   // brindes também custam
    const lucro = custoTot == null ? null : arred(receita - custoTot);
    return { ...g, k, venda: c.venda == null || c.venda === "" ? null : +c.venda, medio: qVend ? receita / qVend : null,
      receita: arred(receita), custoUn, custoTot, lucro, margem: lucro == null || !receita ? null : lucro / receita, qBrinde, semValor };
  });
}

function renderLucro() {
  const main = document.getElementById("main");
  main.innerHTML = `
    <div class="evhead"><span class="eyebrow">Itens e lucro · ${esc(rotuloMes())}</span><h2>Quanto ganhamos em cada item</h2>
      <p class="hint">Preencha o <b>custo do fornecedor</b> por unidade (e, se quiser, o preço de venda de tabela). A receita vem do que foi vendido nos orçamentos do mês; o custo conta todas as unidades, inclusive as dadas de brinde.</p></div>
    ${LIVE ? "" : `<div class="callout ro">Somente leitura: os valores não podem ser editados nesta visualização. Veja o motivo na faixa do topo.</div>`}
    <div id="lkpis"></div>
    <div class="tools">
      <input id="lq" type="search" placeholder="Buscar produto" aria-label="Buscar produto">
      <select id="lcat" aria-label="Categoria"><option value="">Todas as categorias</option>${CAT_ORDER.map(c => `<option value="${c}">${CAT[c]}</option>`).join("")}</select>
      <select id="lsit" aria-label="Situação"><option value="">Todos os produtos</option><option value="sem">Sem custo preenchido</option><option value="com">Com custo preenchido</option><option value="neg">Com prejuízo</option></select>
      <select id="lord" aria-label="Ordenar"><option value="receita">Maior receita</option><option value="lucro">Maior lucro</option><option value="margem">Maior margem</option><option value="qtd">Maior quantidade</option><option value="nome">Nome</option></select>
    </div>
    <div class="tablebox"><table class="lt">
      <thead><tr><th>Produto</th><th class="r">Qtd no mês</th><th class="r">Preço de venda<span class="th2">tabela, por un.</span></th><th class="r">Vendido em média<span class="th2">por un.</span></th><th class="r">Custo do fornecedor<span class="th2">por un.</span></th><th class="r">Receita</th><th class="r">Custo total</th><th class="r">Lucro</th><th class="r">Margem</th></tr></thead>
      <tbody id="lrows"></tbody>
    </table></div>`;
  const lq = document.getElementById("lq"), lcat = document.getElementById("lcat"), lsit = document.getElementById("lsit"), lord = document.getElementById("lord");
  const body = document.getElementById("lrows");

  const kpisLucro = ls => {
    const com = ls.filter(l => l.custoUn != null), sem = ls.filter(l => l.custoUn == null);
    const rec = com.reduce((a, l) => a + l.receita, 0), cus = com.reduce((a, l) => a + l.custoTot, 0), luc = rec - cus;
    const recSem = sem.reduce((a, l) => a + l.receita, 0);
    document.getElementById("lkpis").innerHTML = `<div class="kpis">
      <div class="kpi"><span class="eyebrow">Receita</span><span class="v">${brl(arred(rec))}</span><span class="s">itens com custo preenchido</span></div>
      <div class="kpi"><span class="eyebrow">Custo dos fornecedores</span><span class="v">${brl(arred(cus))}</span><span class="s">${com.length} produtos</span></div>
      <div class="kpi lucro"><span class="eyebrow">Lucro do mês</span><span class="v">${brl(arred(luc))}</span><span class="s">margem ${pct(rec ? luc / rec : null)}</span></div>
      <div class="kpi hl"><span class="eyebrow">Sem custo preenchido</span><span class="v">${sem.length}</span><span class="s">${brl(arred(recSem))} em vendas fora da conta</span></div>
    </div>`;
  };

  const linhaHtml = l => {
    const dis = LIVE ? "" : " disabled";
    const cls = l.lucro == null ? "" : l.lucro < 0 ? "neg" : "pos";
    const notas = [l.qBrinde ? `${int(l.qBrinde)} un. de brinde` : "", l.semValor ? `${l.semValor} sem valor no orçamento` : ""].filter(Boolean).join(" · ");
    return `<tr data-k="${esc(l.k)}">
      <td class="fo-n">${esc(l.nome)}<span class="sub">${l.formandos.size} formando${l.formandos.size > 1 ? "s" : ""}${notas ? " · " + esc(notas) : ""}</span></td>
      <td class="r num">${int(l.qtd)}</td>
      <td class="r"><input class="np-in r money" data-campo="venda" data-nome="${esc(l.nome)}" type="number" min="0" step="0.01" inputmode="decimal" value="${l.venda == null ? "" : l.venda}" placeholder="${l.medio == null ? "0,00" : arred(l.medio).toFixed(2)}" aria-label="Preço de venda de ${esc(l.nome)}"${dis}></td>
      <td class="r num muted">${l.medio == null ? "—" : brl(arred(l.medio))}</td>
      <td class="r"><input class="np-in r money${l.custoUn == null ? " need" : ""}" data-campo="custo" data-nome="${esc(l.nome)}" type="number" min="0" step="0.01" inputmode="decimal" value="${l.custoUn == null ? "" : l.custoUn}" placeholder="custo" aria-label="Custo do fornecedor de ${esc(l.nome)}"${dis}><span class="rowmsg" data-msg></span></td>
      <td class="r num">${brl(l.receita)}</td>
      <td class="r num">${l.custoTot == null ? `<span class="muted">—</span>` : brl(l.custoTot)}</td>
      <td class="r num lucro-c ${cls}">${l.lucro == null ? `<span class="muted">—</span>` : brl(l.lucro)}</td>
      <td class="r num ${cls}">${pct(l.margem)}</td>
    </tr>`;
  };

  const draw = () => {
    const termo = semAcento(lq.value);
    let ls = linhasLucro();
    kpisLucro(ls);
    ls = ls.filter(l => (!termo || semAcento(l.nome).includes(termo)) && (!lcat.value || l.cat === lcat.value)
      && (lsit.value !== "sem" || l.custoUn == null) && (lsit.value !== "com" || l.custoUn != null) && (lsit.value !== "neg" || (l.lucro != null && l.lucro < 0)));
    const o = lord.value;
    ls.sort((a, b) => o === "nome" ? a.nome.localeCompare(b.nome, "pt-BR") : o === "qtd" ? b.qtd - a.qtd
      : o === "margem" ? (b.margem ?? -9) - (a.margem ?? -9) : o === "lucro" ? (b.lucro ?? -1e9) - (a.lucro ?? -1e9) : b.receita - a.receita);
    const out = [];
    CAT_ORDER.forEach(c => {
      const g = ls.filter(l => l.cat === c);
      if (!g.length) return;
      const com = g.filter(l => l.custoUn != null);
      const rec = g.reduce((a, l) => a + l.receita, 0), luc = com.reduce((a, l) => a + l.lucro, 0), cus = com.reduce((a, l) => a + l.custoTot, 0);
      out.push(`<tr class="grp"><td colspan="5">${CAT[c]} · ${g.length} produtos</td><td class="r num">${brl(arred(rec))}</td><td class="r num">${com.length ? brl(arred(cus)) : "—"}</td><td class="r num ${luc < 0 ? "neg" : "pos"}">${com.length ? brl(arred(luc)) : "—"}</td><td></td></tr>`);
      g.forEach(l => out.push(linhaHtml(l)));
    });
    body.innerHTML = out.length ? out.join("") : `<tr><td colspan="9" class="muted">Nenhum produto com esses filtros.</td></tr>`;
  };
  [lq, lcat, lsit, lord].forEach(el => el.addEventListener(el === lq ? "input" : "change", draw));

  body.addEventListener("change", async e => {
    const inp = e.target.closest("input[data-campo]");
    if (!inp || !LIVE) return;
    const nome = inp.dataset.nome, k = chaveProduto(nome), campo = inp.dataset.campo;
    const v = inp.value.trim() === "" ? null : num(inp.value);
    if (v != null && v < 0) return;
    const msg = inp.parentElement.querySelector("[data-msg]") || inp.closest("tr").querySelector("[data-msg]");
    const atualDoc = CUSTOS[k] || { produto: nome, custo: null, venda: null };
    const doc = { produto: nome, custo: atualDoc.custo ?? null, venda: atualDoc.venda ?? null };
    doc[campo] = v == null ? null : arred(v);
    inp.disabled = true;
    try {
      const { error } = await sb.from("custos").upsert({ chave: k, produto: doc.produto, custo: doc.custo, venda: doc.venda, atualizado_em: new Date().toISOString() });
      if (error) throw error;
      CUSTOS[k] = doc;
      draw();
      const novo = body.querySelector(`tr[data-k="${CSS.escape(k)}"] [data-msg]`);
      if (novo) { novo.className = "rowmsg ok"; novo.textContent = "salvo"; }
    } catch (err) {
      inp.disabled = false;
      if (msg) { msg.className = "rowmsg err"; msg.textContent = erroDb(err); }
    }
  });
  draw();
}

/* ---------- Estoque de copos: entradas e saídas × o que os pedidos do mês pedem ---------- */
const MOVS = {};            // id -> { modelo, tipo: ENTRADA|SAIDA, qtd, data, obs, em }
const COPOS_CFG = {};       // chave do modelo -> { nome, minimo, em }
const EHCOPO = /^(taça|taca|copo)\b/i;
const A_PRODUZIR = new Set(["AGUARDANDO_PRODUCAO", "REPASSADO"]);
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function linhasEstoque() {
  const L = {};
  const get = nome => L[chaveProduto(nome)] = L[chaveProduto(nome)] || { nome, k: chaveProduto(nome), pedidos: 0, aProduzir: 0, entradas: 0, saidas: 0, formandos: new Set() };
  agruparMes(F).filter(g => EHCOPO.test(g.nome)).forEach(g => {
    const l = get(g.nome);
    l.pedidos = g.qtd;
    l.aProduzir = g.itens.filter(i => A_PRODUZIR.has(i.status)).reduce((a, i) => a + (i.qtd || 0), 0);
    l.formandos = g.formandos;
  });
  Object.values(COPOS_CFG).forEach(c => { if (c && c.nome) get(c.nome); });
  Object.values(MOVS).forEach(m => {
    if (!m || !m.modelo) return;
    const l = get(m.modelo);
    if (m.tipo === "ENTRADA") l.entradas += +m.qtd || 0; else if (m.tipo === "SAIDA") l.saidas += +m.qtd || 0;
  });
  return Object.values(L).map(l => {
    const c = COPOS_CFG[l.k] || {};
    const minimo = c.minimo == null || c.minimo === "" ? null : +c.minimo;
    const estoque = l.entradas - l.saidas;
    const falta = Math.max(0, l.aProduzir - estoque);
    const sobra = estoque - l.aProduzir;
    const sit = falta > 0 ? (estoque <= 0 ? ["bad", "Sem estoque"] : ["warn", `Faltam ${int(falta)}`])
      : minimo != null && sobra < minimo ? ["warn", "Abaixo do mínimo"]
      : estoque > 0 || l.aProduzir > 0 ? ["ok", "Em dia"] : ["", "Sem movimento"];
    return { ...l, minimo, estoque, falta, sobra, sit };
  }).sort((a, b) => b.falta - a.falta || b.aProduzir - a.aProduzir || a.nome.localeCompare(b.nome, "pt-BR"));
}
const nAlertasEstoque = () => linhasEstoque().filter(l => l.sit[0] === "bad" || l.sit[0] === "warn").length;

function renderEstoque() {
  const main = document.getElementById("main");
  const dis = LIVE ? "" : " disabled";
  main.innerHTML = `
    <div class="evhead"><span class="eyebrow">Estoque de copos</span><h2>Copos e taças em estoque</h2>
      <p class="hint">Registre as <b>entradas</b> (compras recebidas) e as <b>saídas</b> (copos usados na produção, quebrados ou separados). O painel compara o estoque com os copos dos pedidos (todos os meses) que ainda estão aguardando produção ou foram repassados, e mostra quanto falta comprar.</p></div>
    ${LIVE ? "" : `<div class="callout ro">Somente leitura: as movimentações não podem ser registradas nesta visualização. Veja o motivo na faixa do topo.</div>`}
    <div id="ekpis"></div>
    <form class="panel np" id="emov" novalidate>
      <h3>Registrar movimentação</h3>
      <div class="two np-head" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
        <div class="field"><label for="emod">Modelo</label><select id="emod"${dis}></select>
          <input id="enovo" type="text" maxlength="80" placeholder="Nome do novo modelo" aria-label="Nome do novo modelo" hidden${dis}></div>
        <div class="field"><label for="etipo">Tipo</label><select id="etipo"${dis}><option value="ENTRADA">Entrada · compra recebida</option><option value="SAIDA">Saída · usado, quebrado ou separado</option></select></div>
        <div class="field"><label for="eqtd">Quantidade</label><input id="eqtd" type="number" min="1" step="1" inputmode="numeric" placeholder="0"${dis}></div>
        <div class="field"><label for="edata">Data</label><input id="edata" type="date" value="${hojeISO()}"${dis}></div>
        <div class="field"><label for="eobs">Observação</label><input id="eobs" type="text" maxlength="140" placeholder="fornecedor, nota, evento…"${dis}></div>
      </div>
      <div class="np-actions" style="justify-content:flex-start;align-items:center"><button class="btn primary" type="submit" id="esalvar"${dis}>Registrar</button><p class="np-msg" id="emsg" role="status"></p></div>
    </form>
    <div class="tools">
      <input id="eq" type="search" placeholder="Buscar modelo" aria-label="Buscar modelo">
      <select id="esit" aria-label="Situação"><option value="">Todos os modelos</option><option value="alerta">Faltando ou abaixo do mínimo</option><option value="estoque">Com estoque</option></select>
    </div>
    <div class="tablebox"><table class="lt et">
      <thead><tr><th>Modelo</th><th class="r">Em estoque</th><th class="r">Pedidos do mês<span class="th2">todas as unidades</span></th><th class="r">A produzir<span class="th2">aguardando / repassado</span></th><th class="r">Falta comprar</th><th class="r">Sobra após produzir</th><th class="r">Estoque mínimo<span class="th2">alerta abaixo disso</span></th><th>Situação</th></tr></thead>
      <tbody id="erows"></tbody>
    </table></div>
    <div class="panel"><h3>Últimas movimentações</h3><div id="ehist"></div></div>`;

  const sel = document.getElementById("emod"), novo = document.getElementById("enovo");
  const q = document.getElementById("eq"), fs = document.getElementById("esit"), body = document.getElementById("erows");

  const fillModelos = () => {
    const atualV = sel.value;
    const nomes = linhasEstoque().map(l => l.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
    sel.innerHTML = nomes.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("") + `<option value="__novo">Outro modelo…</option>`;
    if (atualV && [...sel.options].some(o => o.value === atualV)) sel.value = atualV;
    novo.hidden = sel.value !== "__novo";
  };
  sel.addEventListener("change", () => { novo.hidden = sel.value !== "__novo"; if (!novo.hidden) novo.focus(); });

  const draw = () => {
    const ls = linhasEstoque();
    const tot = ls.reduce((a, l) => a + Math.max(0, l.estoque), 0), prod = ls.reduce((a, l) => a + l.aProduzir, 0);
    const falta = ls.filter(l => l.falta > 0), alertas = ls.filter(l => l.sit[0] === "bad" || l.sit[0] === "warn");
    document.getElementById("ekpis").innerHTML = `<div class="kpis">
      <div class="kpi"><span class="eyebrow">Em estoque</span><span class="v">${int(tot)}</span><span class="s">copos e taças, ${ls.filter(l => l.estoque > 0).length} modelos</span></div>
      <div class="kpi"><span class="eyebrow">A produzir</span><span class="v">${int(prod)}</span><span class="s">unidades nos pedidos</span></div>
      <div class="kpi hl"><span class="eyebrow">Falta comprar</span><span class="v">${int(falta.reduce((a, l) => a + l.falta, 0))}</span><span class="s">${falta.length} ${falta.length === 1 ? "modelo" : "modelos"}</span></div>
      <div class="kpi"><span class="eyebrow">Alertas</span><span class="v">${alertas.length}</span><span class="s">faltando ou abaixo do mínimo</span></div>
    </div>`;
    const termo = semAcento(q.value);
    const r = ls.filter(l => (!termo || semAcento(l.nome).includes(termo))
      && (fs.value !== "alerta" || l.sit[0] === "bad" || l.sit[0] === "warn") && (fs.value !== "estoque" || l.estoque > 0));
    body.innerHTML = r.length ? r.map(l => `<tr data-k="${esc(l.k)}">
      <td class="fo-n">${esc(l.nome)}<span class="sub">${l.formandos.size ? `${l.formandos.size} formando${l.formandos.size > 1 ? "s" : ""} · ` : ""}${int(l.entradas)} entraram · ${int(l.saidas)} saíram</span></td>
      <td class="r num"><b>${int(l.estoque)}</b></td>
      <td class="r num muted">${int(l.pedidos)}</td>
      <td class="r num">${int(l.aProduzir)}</td>
      <td class="r num ${l.falta ? "neg" : "muted"}">${l.falta ? int(l.falta) : "—"}</td>
      <td class="r num ${l.sobra < 0 ? "neg" : ""}">${int(l.sobra)}</td>
      <td class="r"><input class="np-in r money" data-min data-nome="${esc(l.nome)}" type="number" min="0" step="1" inputmode="numeric" value="${l.minimo ?? ""}" placeholder="—" aria-label="Estoque mínimo de ${esc(l.nome)}"${dis}><span class="rowmsg" data-msg></span></td>
      <td>${l.sit[0] ? `<span class="chip ${l.sit[0]}">${l.sit[1]}</span>` : `<span class="muted">${l.sit[1]}</span>`}</td>
    </tr>`).join("") : `<tr><td colspan="8" class="muted">Nenhum modelo com esse filtro.</td></tr>`;

    const ms = Object.entries(MOVS).filter(([, m]) => m && m.modelo)
      .sort((a, b) => String(b[1].data).localeCompare(String(a[1].data)) || String(b[1].em).localeCompare(String(a[1].em))).slice(0, 40);
    document.getElementById("ehist").innerHTML = ms.length ? `<div class="tablebox"><table class="et-h"><thead><tr><th>Data</th><th>Modelo</th><th>Tipo</th><th class="r">Qtd</th><th>Observação</th><th></th></tr></thead><tbody>${ms.map(([id, m]) => `<tr>
        <td class="num muted">${fmtData(m.data) || "—"}</td><td>${esc(m.modelo)}</td>
        <td>${m.tipo === "ENTRADA" ? `<span class="chip ok">Entrada</span>` : `<span class="chip warn">Saída</span>`}</td>
        <td class="r num">${m.tipo === "ENTRADA" ? "+" : "−"}${int(+m.qtd || 0)}</td>
        <td class="obs">${esc(m.obs || "")}</td>
        <td class="r"><button class="btn x" type="button" data-delmov="${esc(id)}" aria-label="Apagar movimentação"${dis}>Apagar</button></td>
      </tr>`).join("")}</tbody></table></div>`
      : `<p class="hint">Nenhuma movimentação ainda. Comece registrando a contagem atual de cada modelo como uma entrada.</p>`;
  };
  q.addEventListener("input", draw);
  fs.addEventListener("change", draw);

  body.addEventListener("change", async e => {
    const inp = e.target.closest("input[data-min]");
    if (!inp || !LIVE) return;
    const nome = inp.dataset.nome, k = chaveProduto(nome);
    const v = inp.value.trim() === "" ? null : Math.round(num(inp.value));
    if (v != null && (!isFinite(v) || v < 0)) return;
    const msg = inp.parentElement.querySelector("[data-msg]");
    inp.disabled = true;
    try {
      const doc = { nome, minimo: v, em: new Date().toISOString() };
      const { error } = await sb.from("copos_config").upsert({ chave: k, nome, minimo: v, atualizado_em: doc.em });
      if (error) throw error;
      COPOS_CFG[k] = doc;
      draw();
      const m = body.querySelector(`tr[data-k="${CSS.escape(k)}"] [data-msg]`);
      if (m) { m.className = "rowmsg ok"; m.textContent = "salvo"; }
      renderFolders();
    } catch (err) { inp.disabled = false; if (msg) { msg.className = "rowmsg err"; msg.textContent = erroDb(err); } }
  });

  document.getElementById("ehist").addEventListener("click", async e => {
    const b = e.target.closest("[data-delmov]");
    if (!b || !LIVE) return;
    if (b.dataset.conf !== "1") { b.dataset.conf = "1"; b.textContent = "Confirmar"; b.classList.add("bad"); return; }
    b.disabled = true;
    try {
      const { data, error } = await sb.from("estoque_movimentos").delete().eq("id", b.dataset.delmov).select("id");
      if (error) throw error;
      if (!data || !data.length) throw new Error("nada foi salvo");
      delete MOVS[b.dataset.delmov]; draw(); renderFolders();
    }
    catch (err) { b.disabled = false; b.textContent = erroDb(err); }
  });

  document.getElementById("emov").addEventListener("submit", async e => {
    e.preventDefault();
    if (!LIVE) return;
    const msg = document.getElementById("emsg");
    const modelo = (sel.value === "__novo" ? novo.value : sel.value).trim().replace(/\s+/g, " ");
    const tipo = document.getElementById("etipo").value;
    const qtd = Math.round(num(document.getElementById("eqtd").value) ?? 0);
    const data = document.getElementById("edata").value;
    const obs = document.getElementById("eobs").value.trim();
    const erro = t => { msg.className = "np-msg err"; msg.textContent = t; };
    if (!modelo) return erro("Escolha o modelo ou digite o nome do novo modelo.");
    if (!(qtd > 0)) return erro("Informe uma quantidade maior que zero.");
    if (!DATA_OK.test(data)) return erro("Informe a data da movimentação.");
    if (tipo === "SAIDA") {
      const l = linhasEstoque().find(x => x.k === chaveProduto(modelo));
      const tem = l ? l.estoque : 0;
      if (qtd > tem) return erro(`Só há ${int(Math.max(0, tem))} em estoque de ${modelo}. Registre a entrada antes da saída.`);
    }
    const id = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const doc = { modelo, tipo, qtd, data, obs, em: new Date().toISOString() };
    const btn = document.getElementById("esalvar");
    btn.disabled = true; msg.className = "np-msg"; msg.textContent = "Salvando…";
    try {
      const { error } = await sb.from("estoque_movimentos").insert({ id, modelo, tipo, qtd, data, obs: obs || null });
      if (error) throw error;
      MOVS[id] = doc;
      fillModelos();
      const nm = (linhasEstoque().find(l => l.k === chaveProduto(modelo)) || {}).nome;
      if (nm) sel.value = nm;
      novo.hidden = sel.value !== "__novo"; novo.value = "";
      document.getElementById("eqtd").value = ""; document.getElementById("eobs").value = "";
      draw(); renderFolders();
      msg.className = "np-msg ok"; msg.textContent = `${tipo === "ENTRADA" ? "Entrada" : "Saída"} de ${int(qtd)} ${modelo} registrada.`;
    } catch (err) { erro(erroDb(err)); }
    btn.disabled = !LIVE;
  });

  fillModelos();
  draw();
}

/* ---------- Estoque geral: estoque × itens dos pedidos = o que falta pedir ---------- */
const EGERAL = {};         // chave do produto -> { produto, cat, qtd, minimo, custom, em }
const CONSUMIDO = new Set(["PRONTO", "ENTREGUE"]);   // já separado / entregue: saiu da conta do estoque

function linhasEstoqueGeral() {
  const grupos = agruparMes(F);
  const vistos = new Set();
  // Copos e taças têm o estoque controlado por entradas e saídas na pasta "Estoque de copos"
  const copos = {};
  try { linhasEstoque().forEach(c => { copos[c.k] = c; }); } catch (err) {}
  const ls = grupos.map(g => {
    const k = chaveProduto(g.nome); vistos.add(k);
    let e = EGERAL[k] || {};
    if (EHCOPO.test(g.nome)) {
      const c = copos[k], temMov = c && (c.entradas || c.saidas);
      e = { qtd: temMov ? c.estoque : null, minimo: c && c.minimo != null ? c.minimo : null, deCopos: true };
    }
    const usados = g.itens.filter(i => CONSUMIDO.has(i.status));
    const pend = g.itens.filter(i => !CONSUMIDO.has(i.status));
    const pedidos = pend.filter(i => i.pedido || i.status === "REPASSADO" || i.status === "EM_PRODUCAO");
    const semPed = pend.filter(i => !pedidos.includes(i));
    const q = l => l.reduce((a, i) => a + (i.qtd || 0), 0);
    const forn = {};
    semPed.forEach(i => { const n = i.fornId ? SUP[i.fornId] : "Fornecedor a definir"; forn[n] = (forn[n] || 0) + (i.qtd || 0); });
    return mkLinhaEg(k, g.nome, g.cat, e, q(usados), q(pend), q(pedidos), q(semPed), forn);
  });
  Object.entries(EGERAL).forEach(([k, e]) => { if (!vistos.has(k)) ls.push(mkLinhaEg(k, e.produto || k, CAT[e.cat] ? e.cat : "OUTROS", e, 0, 0, 0, 0, {})); });
  return ls;
}
function mkLinhaEg(k, nome, cat, e, usado, pendente, jaPedido, semPedido, forn) {
  const estoque = e.qtd == null || e.qtd === "" ? null : +e.qtd;
  const minimo = e.minimo == null || e.minimo === "" ? 0 : +e.minimo;
  const precisa = semPedido + minimo;                       // o que ainda não tem pedido + reserva mínima
  const aPedir = estoque == null ? null : Math.max(0, precisa - estoque);
  const sobra = estoque == null ? null : Math.max(0, estoque - precisa);
  const principal = Object.entries(forn).sort((a, b) => b[1] - a[1])[0];
  return { k, nome, cat, estoque, minimo, usado, pendente, jaPedido, semPedido, aPedir, sobra, forn, fornPrincipal: principal ? principal[0] : "Fornecedor a definir", custom: !!e.custom, deCopos: !!e.deCopos };
}

function textoListaCompras(ls) {
  const porForn = {};
  ls.filter(l => l.aPedir > 0).forEach(l => { (porForn[l.fornPrincipal] = porForn[l.fornPrincipal] || []).push(l); });
  const hoje = new Date().toLocaleDateString("pt-BR");
  return Object.entries(porForn).sort((a, b) => a[0].localeCompare(b[0], "pt-BR")).map(([f, l]) =>
    `${f}\n` + l.map(x => `- ${x.nome}: ${x.aPedir} un.`).join("\n")).join("\n\n")
    .replace(/^/, `Lista de compras MCM · ${hoje}\n\n`);
}

function renderEstoqueGeral() {
  const main = document.getElementById("main");
  const dis = LIVE ? "" : " disabled";
  main.innerHTML = `
    <div class="evhead"><span class="eyebrow">Estoque geral</span><h2>Estoque × itens dos pedidos</h2>
      <p class="hint">Informe quanto tem <b>em estoque</b> de cada produto. O painel compara com o que os pedidos ainda precisam (itens que não estão prontos nem entregues), desconta o que já foi pedido ao fornecedor e mostra o que <b>falta pedir</b>. Itens marcados como Pronto ou Entregue contam como já utilizados. Copos e taças usam o estoque registrado na pasta <b>Estoque de copos</b>.</p></div>
    ${LIVE ? "" : `<div class="callout ro">Somente leitura: o estoque não pode ser editado nesta visualização. Veja o motivo na faixa do topo.</div>`}
    <div id="gkpis"></div>
    <div class="tools">
      <input id="gq" type="search" placeholder="Buscar produto" aria-label="Buscar produto">
      <select id="gcat" aria-label="Categoria"><option value="">Todas as categorias</option>${CAT_ORDER.map(c => `<option value="${c}">${CAT[c]}</option>`).join("")}</select>
      <select id="gsit" aria-label="Situação"><option value="">Todos os produtos</option><option value="pedir">Falta pedir</option><option value="ok">Estoque cobre</option><option value="sem">Sem estoque informado</option><option value="pend">Com itens pendentes</option></select>
      <select id="gord" aria-label="Ordenar"><option value="pedir">Mais urgente (falta pedir)</option><option value="pend">Mais pendentes</option><option value="nome">Nome</option></select>
    </div>
    <div class="tablebox"><table class="eg">
      <thead><tr><th>Produto</th><th class="r">Já utilizado<span class="th2">pronto / entregue</span></th><th class="r">Pendente<span class="th2">nos pedidos</span></th><th class="r">Já pedido<span class="th2">ao fornecedor</span></th><th class="r">Em estoque</th><th class="r">Estoque mínimo<span class="th2">reserva</span></th><th class="r">Falta pedir</th><th>Pedir a</th></tr></thead>
      <tbody id="grows"></tbody>
    </table></div>
    <div class="two">
      <div class="panel"><div class="np-sh"><h3>Lista de compras</h3><button type="button" class="btn" id="gcopy">Copiar lista</button></div>
        <p class="hint">O que falta pedir, separado pelo fornecedor mais usado em cada produto. Copie e mande para os fornecedores.</p>
        <pre class="lista" id="glista"></pre><span class="rowmsg" id="gcopymsg" role="status"></span></div>
      <div class="panel"><h3>Adicionar item ao estoque</h3>
        <p class="hint">Para materiais que não aparecem nos pedidos (ex.: filme DTF, fita, embalagens).</p>
        <form id="gadd" class="np-head" novalidate>
          <div class="field"><label for="gaddnome">Produto</label><input id="gaddnome" placeholder="Nome do material"${dis}></div>
          <div class="field"><label for="gaddcat">Categoria</label><select id="gaddcat"${dis}>${CAT_ORDER.map(c => `<option value="${c}">${CAT[c]}</option>`).join("")}</select></div>
          <div class="field"><label for="gaddqtd">Em estoque</label><input id="gaddqtd" type="number" min="0" step="1"${dis}></div>
          <div class="field"><label for="gaddmin">Estoque mínimo</label><input id="gaddmin" type="number" min="0" step="1"${dis}></div>
          <div><button class="btn primary" type="submit"${dis}>Adicionar</button> <span class="rowmsg" id="gaddmsg" role="status"></span></div>
        </form></div>
    </div>`;

  const gq = document.getElementById("gq"), gcat = document.getElementById("gcat"), gsit = document.getElementById("gsit"), gord = document.getElementById("gord");
  const body = document.getElementById("grows");
  body.addEventListener("click", e => { if (e.target.closest("[data-ircopos]")) abrir("estoque"); });

  const linha = l => {
    const st = l.estoque == null ? "sem" : l.aPedir > 0 ? "pedir" : "ok";
    const fornTxt = Object.entries(l.forn).sort((a, b) => b[1] - a[1]).map(([n, q]) => `${n} ${int(q)}`).join(" · ");
    return `<tr data-k="${esc(l.k)}" class="st-${st}">
      <td class="fo-n">${esc(l.nome)}${l.custom ? `<span class="sub">item de estoque (fora dos pedidos)</span>` : l.deCopos ? `<span class="sub">estoque controlado na pasta Estoque de copos</span>` : ""}</td>
      <td class="r num muted">${int(l.usado)}</td>
      <td class="r num">${int(l.pendente)}</td>
      <td class="r num">${l.jaPedido ? int(l.jaPedido) : `<span class="muted">0</span>`}</td>
      ${l.deCopos
        ? `<td class="r num">${l.estoque == null ? `<button type="button" class="btn x" data-ircopos>registrar entrada</button>` : int(l.estoque)}</td>
           <td class="r num muted">${l.minimo ? int(l.minimo) : "—"}</td>`
        : `<td class="r"><input class="np-in r qty${l.estoque == null ? " need" : ""}" data-campo="qtd" data-nome="${esc(l.nome)}" data-cat="${esc(l.cat)}" type="number" min="0" step="1" inputmode="numeric" value="${l.estoque == null ? "" : l.estoque}" placeholder="qtd" aria-label="Estoque de ${esc(l.nome)}"${dis}><span class="rowmsg" data-msg></span></td>
           <td class="r"><input class="np-in r qty" data-campo="minimo" data-nome="${esc(l.nome)}" data-cat="${esc(l.cat)}" type="number" min="0" step="1" inputmode="numeric" value="${l.minimo || ""}" placeholder="0" aria-label="Estoque mínimo de ${esc(l.nome)}"${dis}></td>`}
      <td class="r num apedir">${l.estoque == null ? `<span class="muted">${l.deCopos ? "sem movimentação" : "informe o estoque"}</span>` : l.aPedir > 0 ? `<b>${int(l.aPedir)}</b>` : `<span class="chip ok">ok${l.sobra ? ` · sobram ${int(l.sobra)}` : ""}</span>`}</td>
      <td class="forn-c" title="${esc(fornTxt)}">${l.aPedir > 0 ? esc(l.fornPrincipal) : `<span class="muted">${esc(fornTxt || "—")}</span>`}</td>
    </tr>`;
  };

  const draw = () => {
    const todas = linhasEstoqueGeral();
    const pedir = todas.filter(l => l.aPedir > 0), sem = todas.filter(l => l.estoque == null && l.pendente > 0);
    document.getElementById("gkpis").innerHTML = `<div class="kpis">
      <div class="kpi hl"><span class="eyebrow">Falta pedir</span><span class="v">${pedir.length} produtos</span><span class="s">${int(pedir.reduce((a, l) => a + l.aPedir, 0))} unidades</span></div>
      <div class="kpi"><span class="eyebrow">Pendente nos pedidos</span><span class="v">${int(todas.reduce((a, l) => a + l.pendente, 0))} un.</span><span class="s">ainda não prontos nem entregues</span></div>
      <div class="kpi"><span class="eyebrow">Já pedido ao fornecedor</span><span class="v">${int(todas.reduce((a, l) => a + l.jaPedido, 0))} un.</span><span class="s">com data de pedido ou repassado</span></div>
      <div class="kpi"><span class="eyebrow">Sem estoque informado</span><span class="v">${sem.length}</span><span class="s">produtos com itens pendentes</span></div>
    </div>`;
    document.getElementById("glista").textContent = pedir.length ? textoListaCompras(todas) : "Nada para pedir no momento (ou falta informar o estoque).";
    const termo = semAcento(gq.value);
    let ls = todas.filter(l => (!termo || semAcento(l.nome).includes(termo)) && (!gcat.value || l.cat === gcat.value)
      && (gsit.value !== "pedir" || l.aPedir > 0) && (gsit.value !== "ok" || (l.estoque != null && l.aPedir === 0))
      && (gsit.value !== "sem" || l.estoque == null) && (gsit.value !== "pend" || l.pendente > 0));
    const o = gord.value;
    ls.sort((a, b) => o === "nome" ? a.nome.localeCompare(b.nome, "pt-BR") : o === "pend" ? b.pendente - a.pendente
      : ((b.aPedir ?? -1) - (a.aPedir ?? -1)) || (b.semPedido - a.semPedido));
    const out = [];
    CAT_ORDER.forEach(c => {
      const g = ls.filter(l => l.cat === c);
      if (!g.length) return;
      out.push(`<tr class="grp"><td colspan="6">${CAT[c]} · ${g.length} produtos</td><td class="r num">${int(g.reduce((a, l) => a + (l.aPedir || 0), 0))}</td><td></td></tr>`);
      g.forEach(l => out.push(linha(l)));
    });
    body.innerHTML = out.length ? out.join("") : `<tr><td colspan="8" class="muted">Nenhum produto com esses filtros.</td></tr>`;
  };
  [gq, gcat, gsit, gord].forEach(el => el.addEventListener(el === gq ? "input" : "change", draw));

  const salvarEst = async (nome, cat, patch, custom) => {
    const k = chaveProduto(nome);
    const a = EGERAL[k] || {};
    const doc = { produto: nome, cat, qtd: a.qtd ?? null, minimo: a.minimo ?? null, custom: custom ?? !!a.custom, em: new Date().toISOString(), ...patch };
    const { error } = await sb.from("estoque_geral").upsert({ chave: k, produto: nome, categoria: CAT[cat] ? cat : "OUTROS", qtd: doc.qtd, minimo: doc.minimo, avulso: doc.custom, atualizado_em: doc.em });
    if (error) throw error;
    EGERAL[k] = doc;
    return k;
  };

  body.addEventListener("change", async e => {
    const inp = e.target.closest("input[data-campo]");
    if (!inp || !LIVE) return;
    const v = inp.value.trim() === "" ? null : Math.round(num(inp.value));
    if (v != null && (!isFinite(v) || v < 0)) return;
    inp.disabled = true;
    try {
      const k = await salvarEst(inp.dataset.nome, inp.dataset.cat, { [inp.dataset.campo]: v });
      draw();
      const m = body.querySelector(`tr[data-k="${CSS.escape(k)}"] [data-msg]`);
      if (m) { m.className = "rowmsg ok"; m.textContent = "salvo"; }
    } catch (err) {
      inp.disabled = false;
      const m = inp.closest("tr").querySelector("[data-msg]");
      if (m) { m.className = "rowmsg err"; m.textContent = erroDb(err); }
    }
  });

  document.getElementById("gadd").addEventListener("submit", async e => {
    e.preventDefault();
    const msg = document.getElementById("gaddmsg");
    const nome = document.getElementById("gaddnome").value.trim();
    if (!nome) { msg.className = "rowmsg err"; msg.textContent = "Digite o nome do produto."; return; }
    const q = num(document.getElementById("gaddqtd").value), m = num(document.getElementById("gaddmin").value);
    try {
      await salvarEst(nome, document.getElementById("gaddcat").value, { qtd: q == null ? null : Math.round(q), minimo: m == null ? null : Math.round(m) }, true);
      ["gaddnome", "gaddqtd", "gaddmin"].forEach(id => { document.getElementById(id).value = ""; });
      msg.className = "rowmsg ok"; msg.textContent = `${nome} adicionado.`;
      draw();
    } catch (err) { msg.className = "rowmsg err"; msg.textContent = erroDb(err); }
  });

  document.getElementById("gcopy").addEventListener("click", async () => {
    const txt = document.getElementById("glista").textContent, m = document.getElementById("gcopymsg");
    try { await navigator.clipboard.writeText(txt); m.className = "rowmsg ok"; m.textContent = "Lista copiada."; }
    catch (err) {
      const r = document.createRange(); r.selectNodeContents(document.getElementById("glista"));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      m.className = "rowmsg"; m.textContent = "Lista selecionada: use Ctrl+C para copiar.";
    }
  });
  draw();
}

/* ---------- Próximas entregas: o que vence primeiro e o que já passou ---------- */
const calIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h3v17H4V4h3zm-1 7v10h12V9zm2 2h3v3H8z"/></svg>`;
const diasAte = iso => Math.round((new Date(iso + "T12:00:00") - new Date(hojeISO() + "T12:00:00")) / 864e5);
function infoTurma(e) {
  const fos = byEv(e.id), its = allItens(fos), prod = its.filter(i => PRODUCAO.has(i.cat));
  const prontos = prod.filter(i => i.status === "PRONTO" || i.status === "ENTREGUE").length;
  const naoEntregues = its.filter(i => i.status !== "ENTREGUE");
  return { e, iso: isoDe(e), fos, its, prod, prontos, naoEntregues, escolher: sum(fos, "nEscolher"), saldo: sum(fos, "saldo"), comSaldo: fos.filter(f => f.saldo > 0).length };
}
const quando = d => d < 0 ? `há ${-d} dia${d === -1 ? "" : "s"}` : d === 0 ? "hoje" : d === 1 ? "amanhã" : `em ${d} dias`;

async function marcarEntregue(ids) {
  ids = ids.filter(id => ITEM[id] && SAFE_ID.test(id) && ITEM[id].status !== "ENTREGUE");
  if (!ids.length) return 0;
  let n = 0;
  for (let k = 0; k < ids.length; k += 80) {            // em blocos, para o endereço da requisição não ficar grande demais
    const parte = ids.slice(k, k + 80);
    const { data, error } = await sb.from("itens").update({ status: "ENTREGUE", atualizado_em: new Date().toISOString(), atualizado_por: USER ? USER.id : null }).in("id", parte).select("id");
    if (error) throw error;
    (data || []).forEach(r => { if (ITEM[r.id]) { ITEM[r.id].status = "ENTREGUE"; n++; } });
  }
  F.forEach(recalc);
  return n;
}

function renderAgenda() {
  const main = document.getElementById("main");
  const dis = LIVE ? "" : " disabled";
  const ts = EVENTOS.filter(e => isoDe(e)).map(infoTurma);
  const atrasadas = ts.filter(t => diasAte(t.iso) < 0 && t.naoEntregues.length).sort((a, b) => a.iso.localeCompare(b.iso));
  const semana = ts.filter(t => { const d = diasAte(t.iso); return d >= 0 && d <= 7; });
  const mes = ts.filter(t => { const d = diasAte(t.iso); return d > 7 && d <= 30; });
  const depois = ts.filter(t => diasAte(t.iso) > 30);
  const semData = EVENTOS.filter(e => !isoDe(e)).map(infoTurma);
  const linha = t => {
    const d = diasAte(t.iso), pct = t.prod.length ? t.prontos / t.prod.length : 1;
    return `<div class="ag-row${d < 0 ? " late" : d <= 7 ? " soon" : ""}" data-ev="${esc(t.e.id)}">
      <div class="ag-date"><b>${t.e.data.slice(0, 5)}</b><span>${quando(d)}</span></div>
      <div class="ag-main"><button class="ag-name" type="button" data-abrir="${esc(t.e.slug)}">${esc(t.e.nome)}</button>
        <span class="sub">${t.fos.length} cliente${t.fos.length === 1 ? "" : "s"} · ${t.its.length} itens${t.naoEntregues.length && d < 0 ? ` · ${t.naoEntregues.length} sem baixa de entrega` : ""}</span></div>
      <div class="ag-prod" title="Itens de papelaria, lembranças e copos prontos ou entregues"><span class="bar" aria-hidden="true"><i style="width:${(pct * 100).toFixed(0)}%"></i></span><span class="num">${t.prontos}/${t.prod.length} prontos</span></div>
      <div class="ag-chips">${t.escolher ? `<span class="chip warn">${t.escolher} a escolher</span>` : ""}${t.saldo > 0 ? `<span class="chip bad">${brl(t.saldo)} a receber</span>` : `<span class="chip ok">quitado</span>`}</div>
      <div class="ag-act">${d < 0 && t.naoEntregues.length ? `<button class="btn" type="button" data-entregue${dis}>Marcar tudo entregue</button>` : `<button class="btn" type="button" data-abrir="${esc(t.e.slug)}">Abrir</button>`}<span class="rowmsg" data-msg></span></div>
    </div>`;
  };
  const bloco = (titulo, l, vazio, extra) => `<section class="panel ag-sec"><div class="np-sh"><h3>${titulo} <span class="muted">· ${l.length}</span></h3>${extra || ""}</div>
    ${l.length ? `<div class="ag-list">${l.map(linha).join("")}</div>` : `<p class="hint">${vazio}</p>`}</section>`;
  const prox30 = semana.concat(mes);
  main.innerHTML = `<div id="agwrap" class="agwrap">
    <div class="evhead"><span class="eyebrow">Próximas entregas · hoje ${fmtData(hojeISO()).slice(0, 5)}</span><h2>O que vence primeiro</h2>
      <p class="hint">Turmas pela data de entrega. As que já passaram e ainda têm itens sem baixa aparecem em <b>Atrasadas</b>: confira e use <b>Marcar tudo entregue</b> para dar baixa de uma vez.</p></div>
    <div class="kpis">
      <div class="kpi${atrasadas.length ? " hl" : ""}"><span class="eyebrow">Atrasadas</span><span class="v">${atrasadas.length}</span><span class="s">${atrasadas.reduce((a, t) => a + t.naoEntregues.length, 0)} itens sem baixa</span></div>
      <div class="kpi"><span class="eyebrow">Próximos 7 dias</span><span class="v">${semana.length} turma${semana.length === 1 ? "" : "s"}</span><span class="s">${semana.reduce((a, t) => a + t.fos.length, 0)} clientes</span></div>
      <div class="kpi"><span class="eyebrow">A escolher fornecedor</span><span class="v">${prox30.reduce((a, t) => a + t.escolher, 0)}</span><span class="s">itens nos próximos 30 dias</span></div>
      <div class="kpi"><span class="eyebrow">A receber</span><span class="v">${brl(prox30.reduce((a, t) => a + t.saldo, 0))}</span><span class="s">nos próximos 30 dias</span></div>
    </div>
    ${atrasadas.length ? bloco("Atrasadas", atrasadas, "") : ""}
    ${bloco("Próximos 7 dias", semana, "Nenhuma entrega nos próximos 7 dias.")}
    ${bloco("Próximos 30 dias", mes, "Nenhuma entrega entre 8 e 30 dias.")}
    <details class="panel ag-sec ag-mais"><summary><h3>Mais adiante <span class="muted">· ${depois.length}</span></h3></summary>${depois.length ? `<div class="ag-list">${depois.map(linha).join("")}</div>` : `<p class="hint">Nada depois de 30 dias.</p>`}</details>
    ${semData.length ? `<p class="hint">${semData.length} turma${semData.length === 1 ? "" : "s"} sem data não aparece${semData.length === 1 ? "" : "m"} aqui. Coloque a data em <b>Organizar pedidos</b>.</p>` : ""}</div>`;

  document.getElementById("agwrap").addEventListener("click", async ev => {
    const ab = ev.target.closest("[data-abrir]");
    if (ab) { abrir(ab.dataset.abrir); return; }
    const b = ev.target.closest("[data-entregue]");
    if (!b || !LIVE) return;
    const row = b.closest("[data-ev]"), m = row.querySelector("[data-msg]");
    const t = infoTurma(EVENTOS.find(e => e.id === row.dataset.ev));
    if (b.dataset.conf !== "1") { b.dataset.conf = "1"; b.textContent = `Confirmar: ${t.naoEntregues.length} itens`; b.classList.add("bad"); return; }
    b.disabled = true; b.textContent = "Salvando…";
    try {
      const n = await marcarEntregue(t.naoEntregues.map(i => i.id));
      renderFolders(); renderAgenda();
      const r2 = document.querySelector(`.ag-row[data-ev="${CSS.escape(t.e.id)}"] [data-msg]`);
      if (r2) { r2.className = "rowmsg ok"; r2.textContent = `${n} itens entregues`; }
      else { const h = document.querySelector("#main .evhead .hint"); if (h) h.insertAdjacentHTML("afterend", `<p class="rowmsg ok">${esc(t.e.nome)}: ${n} itens marcados como entregues.</p>`); }
    } catch (err) { b.disabled = false; b.textContent = "Marcar tudo entregue"; m.className = "rowmsg err"; m.textContent = erroDb(err); }
  });
}

/* ---------- Busca rápida de cliente (topo) ---------- */
function abrirCliente(foId) {
  const f = F.find(x => x.id === foId), e = f && EVENTOS.find(x => x.id === f.ev);
  if (!e) return;
  aba = "formandos"; abertos.add(f.id);
  abrir(e.slug);
  const d = document.querySelector(`details.fo[data-id="${CSS.escape(f.id)}"]`);
  if (d) { d.open = true; d.scrollIntoView({ block: "start", behavior: "smooth" }); d.classList.add("achado"); setTimeout(() => d.classList.remove("achado"), 2000); }
}
(function wireBusca() {
  const inp = document.getElementById("busca"), res = document.getElementById("buscaRes");
  if (!inp) return;
  let achados = [], foco = 0;
  const fechar = () => { res.hidden = true; achados = []; };
  const desenhar = () => {
    res.innerHTML = achados.length ? achados.map((a, k) => `<button type="button" class="br-it${k === foco ? " on" : ""}" data-k="${k}">${a.html}</button>`).join("")
      : `<p class="hint br-vazio">Nenhum cliente ou turma com esse nome.</p>`;
    res.hidden = false;
  };
  inp.addEventListener("input", () => {
    const t = semAcento(inp.value);
    if (t.length < 2) { fechar(); return; }
    const evs = EVENTOS.filter(e => semAcento(e.nome).includes(t)).slice(0, 4).map(e => ({ tipo: "ev", id: e.slug,
      html: `<span class="br-n">${esc(e.nome)}</span><span class="br-s">turma · ${e.data ? e.data.slice(0, 5) : "sem data"} · ${byEv(e.id).length} clientes</span>` }));
    const fos = F.filter(f => semAcento(f.nome).includes(t)).slice(0, 8).map(f => { const e = EVENTOS.find(x => x.id === f.ev) || {}; return { tipo: "fo", id: f.id,
      html: `<span class="br-n">${esc(f.nome)}</span><span class="br-s">${esc(e.nome || "")}${e.data ? ` · ${e.data.slice(0, 5)}` : ""} · ${f.saldo > 0 ? `saldo ${brl(f.saldo)}` : "quitado"}</span>` }; });
    achados = fos.concat(evs); foco = 0; desenhar();
  });
  const escolher = a => { if (!a) return; fechar(); inp.value = ""; inp.blur(); if (a.tipo === "fo") abrirCliente(a.id); else abrir(a.id); };
  inp.addEventListener("keydown", e => {
    if (res.hidden) return;
    if (e.key === "ArrowDown") { foco = Math.min(achados.length - 1, foco + 1); desenhar(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { foco = Math.max(0, foco - 1); desenhar(); e.preventDefault(); }
    else if (e.key === "Enter") { escolher(achados[foco]); e.preventDefault(); }
    else if (e.key === "Escape") fechar();
  });
  res.addEventListener("mousedown", e => { const b = e.target.closest(".br-it"); if (b) { e.preventDefault(); escolher(achados[+b.dataset.k]); } });
  inp.addEventListener("blur", () => setTimeout(fechar, 150));
  document.addEventListener("keydown", e => { if (e.key === "/" && !/input|select|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); inp.focus(); } });
})();

/* ---------- Organizar pedidos: turmas por mês, montadas à mão ---------- */
const sortIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h8v7H3zm10 0h8v4h-8zm0 6h8v10h-8zM3 13h8v7H3z"/></svg>`;
const isoDe = e => (e && e.data && e.data.length >= 10) ? `${e.data.slice(6, 10)}-${e.data.slice(3, 5)}-${e.data.slice(0, 2)}` : "";
const mesAtualISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
function slugLivre(nome) {
  const base = semAcento(nome).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "turma";
  let s = base, n = 2;
  while (PAGINAS.includes(s) || EVENTOS.some(e => e.slug === s)) s = `${base}-${n++}`;
  return s;
}
// Mantém as turmas em ordem de data (sem data no fim), como no banco
const ordenarEventos = () => EVENTOS.sort((a, b) => (isoDe(a) || "9999").localeCompare(isoDe(b) || "9999") || a.nome.localeCompare(b.nome, "pt-BR"));
function opcoesTurma(selId) {
  let html = "", mesAnt = null;
  EVENTOS.forEach(e => {
    const m = mesDe(e);
    if (m !== mesAnt) { html += `${mesAnt ? "</optgroup>" : ""}<optgroup label="${esc(rotuloDe(m))}">`; mesAnt = m; }
    html += `<option value="${esc(e.id)}"${e.id === selId ? " selected" : ""}>${esc(e.nome)}${e.data ? ` · ${e.data.slice(0, 5)}` : ""}</option>`;
  });
  return html + (mesAnt ? "</optgroup>" : "");
}

async function moverFormandos(ids, evId) {
  ids = ids.filter(id => SAFE_ID.test(id) && FO_INFO[id] && FO_INFO[id].ev !== evId);
  if (!ids.length) return 0;
  const { data, error } = await sb.from("formandos").update({ evento_id: evId }).in("id", ids).select("id");
  if (error) throw error;
  if (!data || !data.length) throw new Error("nada foi salvo");
  ids.forEach(id => { FO_INFO[id].ev = evId; const f = F.find(x => x.id === id); if (f) f.ev = evId; });
  return ids.length;
}

const orgSel = new Set();   // clientes marcados para mover juntos
function renderOrganizar() {
  const main = document.getElementById("main");
  const dis = LIVE ? "" : " disabled";
  const mesPadrao = MES_SEL !== "todos" && MES_SEL !== "sem-data" ? MES_SEL : mesAtualISO();
  main.innerHTML = `
    <div class="evhead"><span class="eyebrow">Organizar pedidos · ${esc(rotuloMes())}</span><h2>Pedidos por mês e turma</h2>
      <p class="hint">Crie as turmas de cada mês e mova os clientes para a turma certa. Cada turma vira uma pasta no menu, no mês escolhido. Para mover vários de uma vez, marque os clientes e use a barra de mover.</p></div>
    ${LIVE ? "" : `<div class="callout ro">Somente leitura: as turmas não podem ser alteradas nesta visualização. Veja o motivo na faixa do topo.</div>`}
    <form class="panel" id="onova" novalidate>
      <h3>Nova turma</h3>
      <div class="np-head two">
        <div class="field"><label for="onome">Nome da turma</label><input id="onome" maxlength="80" placeholder="ex.: MED UNP 2027.1"${dis}></div>
        <div class="field"><label for="omes">Mês</label><input id="omes" type="month" value="${mesPadrao}"${dis}></div>
        <div class="field"><label for="odia">Dia do evento (opcional)</label><input id="odia" type="number" min="1" max="31" step="1" inputmode="numeric" placeholder="—"${dis}></div>
      </div>
      <div class="np-actions" style="justify-content:flex-start;align-items:center"><button class="btn primary" type="submit"${dis}>Criar turma</button><p class="np-msg" id="onovamsg" role="status"></p></div>
    </form>
    <div class="tools org-bar">
      <input id="oq" type="search" placeholder="Buscar cliente ou turma" aria-label="Buscar cliente ou turma">
      <span class="org-sel" id="osel"></span>
      <select id="odest" aria-label="Turma de destino"${dis}>${opcoesTurma("")}</select>
      <button class="btn" type="button" id="omover"${dis}>Mover marcados</button>
      <button class="btn" type="button" id="olimpar">Desmarcar</button>
      <span class="rowmsg" id="omsg" role="status"></span>
    </div>
    <div id="oturmas" class="org-list"></div>`;

  const q = document.getElementById("oq"), lista = document.getElementById("oturmas");
  const msg = (el, t, tipo) => { el.className = (el.id === "onovamsg" ? "np-msg " : "rowmsg ") + (tipo || ""); el.textContent = t; };

  const draw = () => {
    const termo = semAcento(q.value);
    const evs = EVMes();
    const blocos = [];
    let mesAnt = null;
    evs.forEach(e => {
      const fos = byEv(e.id).slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      const bateTurma = !termo || semAcento(e.nome).includes(termo);
      const vis = bateTurma ? fos : fos.filter(f => semAcento(f.nome).includes(termo));
      if (termo && !vis.length && !bateTurma) return;
      const m = mesDe(e);
      if (m !== mesAnt) { blocos.push(`<h3 class="org-mes">${esc(rotuloDe(m))}</h3>`); mesAnt = m; }
      const iso = isoDe(e), total = sum(fos, "devido");
      blocos.push(`<section class="panel org-turma" data-ev="${esc(e.id)}">
        <div class="org-head">
          <input class="org-nome" data-campo="nome" value="${esc(e.nome)}" maxlength="80" aria-label="Nome da turma"${dis}>
          <input class="org-data" data-campo="mes" type="month" value="${iso.slice(0, 7)}" aria-label="Mês da turma"${dis}>
          <input class="org-dia" data-campo="dia" type="number" min="1" max="31" value="${iso ? +iso.slice(8, 10) : ""}" placeholder="dia" aria-label="Dia do evento"${dis}>
          <span class="muted org-tot">${fos.length} cliente${fos.length === 1 ? "" : "s"} · ${brl(total)}</span>
          <button class="btn" type="button" data-abrir="${esc(e.slug)}">Abrir pasta</button>
          ${fos.length ? "" : `<button class="btn x bad" type="button" data-excluir${dis}>Excluir turma</button>`}
          <span class="rowmsg" data-msg></span>
        </div>
        ${vis.length ? `<div class="org-fos">${vis.map(f => `<div class="org-fo">
          <label class="org-ck"><input type="checkbox" data-fo="${esc(f.id)}"${orgSel.has(f.id) ? " checked" : ""}${dis}><span>${esc(f.nome)}</span></label>
          <span class="muted num">${f.itens.length} itens · ${brl(f.devido)}</span>
          <select data-mover="${esc(f.id)}" aria-label="Mover ${esc(f.nome)} para outra turma"${dis}>${opcoesTurma(e.id)}</select>
        </div>`).join("")}</div>` : `<p class="hint">${fos.length ? "Nenhum cliente com essa busca." : "Turma vazia. Mova clientes para cá ou exclua a turma."}</p>`}
      </section>`);
    });
    lista.innerHTML = blocos.length ? blocos.join("") : `<div class="empty">Nenhuma turma ${MES_SEL === "todos" ? "" : "neste mês "}${termo ? "com essa busca" : "ainda"}.</div>`;
    const n = orgSel.size;
    document.getElementById("osel").textContent = n ? `${n} marcado${n > 1 ? "s" : ""}` : "Nenhum cliente marcado";
  };
  const depois = () => { ordenarEventos(); renderFolders(); document.getElementById("odest").innerHTML = opcoesTurma(document.getElementById("odest").value); draw(); };

  q.addEventListener("input", draw);
  document.getElementById("olimpar").addEventListener("click", () => { orgSel.clear(); draw(); });

  lista.addEventListener("click", async e => {
    const ab = e.target.closest("[data-abrir]");
    if (ab) { abrir(ab.dataset.abrir); return; }
    const ex = e.target.closest("[data-excluir]");
    if (!ex || !LIVE) return;
    const sec = ex.closest("[data-ev]"), id = sec.dataset.ev, m = sec.querySelector("[data-msg]");
    if (byEv(id).length) return;
    if (ex.dataset.conf !== "1") { ex.dataset.conf = "1"; ex.textContent = "Confirmar exclusão"; return; }
    ex.disabled = true;
    try {
      const { data, error } = await sb.from("eventos").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data || !data.length) throw new Error("nada foi salvo");
      EVENTOS.splice(EVENTOS.findIndex(x => x.id === id), 1);
      depois();
    } catch (err) { ex.disabled = false; msg(m, erroDb(err), "err"); }
  });

  lista.addEventListener("change", async e => {
    const t = e.target;
    if (t.matches("input[data-fo]")) { if (t.checked) orgSel.add(t.dataset.fo); else orgSel.delete(t.dataset.fo); draw(); return; }
    if (!LIVE) return;
    const sec = t.closest("[data-ev]"), m = sec && sec.querySelector("[data-msg]");
    if (t.matches("select[data-mover]")) {
      t.disabled = true;
      try { await moverFormandos([t.dataset.mover], t.value); orgSel.delete(t.dataset.mover); depois(); }
      catch (err) { t.disabled = false; msg(m, erroDb(err), "err"); }
      return;
    }
    if (t.matches("[data-campo]")) {
      const ev = EVENTOS.find(x => x.id === sec.dataset.ev);
      const nome = sec.querySelector(".org-nome").value.trim().replace(/\s+/g, " ");
      const mes = sec.querySelector(".org-data").value, dia = Math.round(num(sec.querySelector(".org-dia").value) || 0);
      if (!nome) { msg(m, "Dê um nome para a turma.", "err"); return; }
      if (dia && (dia < 1 || dia > 31)) { msg(m, "Dia entre 1 e 31.", "err"); return; }
      const data = /^\d{4}-\d{2}$/.test(mes) ? `${mes}-${String(dia || 1).padStart(2, "0")}` : null;
      if (data && isNaN(new Date(data + "T12:00:00").getTime())) { msg(m, "Data inválida.", "err"); return; }
      try {
        const { data: r, error } = await sb.from("eventos").update({ nome, data }).eq("id", ev.id).select("id");
        if (error) throw error;
        if (!r || !r.length) throw new Error("nada foi salvo");
        ev.nome = nome; ev.data = data ? fmtData(data) : "";
        depois();
        const s2 = lista.querySelector(`[data-ev="${CSS.escape(ev.id)}"] [data-msg]`);
        if (s2) msg(s2, "salvo", "ok");
      } catch (err) { msg(m, erroDb(err), "err"); }
    }
  });

  document.getElementById("omover").addEventListener("click", async () => {
    const m = document.getElementById("omsg"), dest = document.getElementById("odest").value;
    if (!LIVE) return;
    if (!orgSel.size) { msg(m, "Marque os clientes que quer mover.", "err"); return; }
    const b = document.getElementById("omover"); b.disabled = true;
    try {
      const n = await moverFormandos([...orgSel], dest);
      const ev = EVENTOS.find(x => x.id === dest);
      orgSel.clear(); depois();
      msg(document.getElementById("omsg"), `${n} cliente${n === 1 ? "" : "s"} movido${n === 1 ? "" : "s"} para ${ev ? ev.nome : "a turma"}.`, "ok");
    } catch (err) { msg(m, erroDb(err), "err"); }
    b.disabled = !LIVE;
  });

  document.getElementById("onova").addEventListener("submit", async e => {
    e.preventDefault();
    if (!LIVE) return;
    const m = document.getElementById("onovamsg");
    const nome = document.getElementById("onome").value.trim().replace(/\s+/g, " ");
    const mes = document.getElementById("omes").value, dia = Math.round(num(document.getElementById("odia").value) || 0);
    if (!nome) { msg(m, "Dê um nome para a turma.", "err"); return; }
    if (!/^\d{4}-\d{2}$/.test(mes)) { msg(m, "Escolha o mês.", "err"); return; }
    if (dia && (dia < 1 || dia > 31)) { msg(m, "Dia entre 1 e 31.", "err"); return; }
    const data = `${mes}-${String(dia || 1).padStart(2, "0")}`;
    if (isNaN(new Date(data + "T12:00:00").getTime())) { msg(m, "Data inválida.", "err"); return; }
    const novo = { id: "ev_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nome, data, slug: slugLivre(nome), ordem: 100 };
    try {
      const { error } = await sb.from("eventos").insert(novo);
      if (error) throw error;
      EVENTOS.push({ id: novo.id, nome, data: fmtData(data), slug: novo.slug });
      document.getElementById("onome").value = ""; document.getElementById("odia").value = "";
      depois();
      msg(m, `Turma ${nome} criada em ${rotuloDe(mes)}.`, "ok");
    } catch (err) { msg(m, erroDb(err), "err"); }
  });

  draw();
}

/* ---------- Resumo do mês: cada produto somado em todos os eventos ---------- */
const semAcento = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const CANON = [
  [/vetoriza/, "Vetorização"],
  [/identidade visual|id visual|^id$|taxa.*\bid\b/, "Identidade visual (taxa)"],
  [/taxa.*(papelaria|arte)/, "Taxa de papelaria"],
  [/desmontagem|demonstagem|recolhimento/, "Taxa de desmontagem / recolhimento"],
  [/flor|arranjo|hortensia|tulipa|tubos?\b|box floral|folhahem|folhagem|cascata/, "Flores e arranjos"],
  [/vela/, "Velas (locação)"],
  [/porta piru|porta pirtu|porta canudo/, "Porta pirulito / canudo"],
  [/porta bottons?/, "Porta bottons"],
  [/suporte|pecas?\b|modulos?\b|kit .*loca|kit \d|aramad/, "Peças e suportes para doces (locação)"],
  [/topiaria|torre/, "Topiaria"],
  [/bemm? ?(casado|formando)/, "Bem casado / bem formando"],
  [/chocolate|ferrero|bombo/, "Chocolates"],
  [/doces? gourmet|doces p\/ mesa gourmet/, "Doces gourmet"],
  [/^(doces?|brigadeiros?|simples)\b|doces p\/|doce simples/, "Doces simples"],
  [/fatia|bolo/, "Bolo / fatias"],
  [/souplast/, "Souplast"],
  [/bottons?/, "Bottons"],
  [/marcador/, "Marcador de mesa"],
  [/\bmenu\b/, "Menu"],
  [/guardanapo.*linho/, "Guardanapo de linho"],
  [/guardanapo.*sem tag/, "Guardanapo de algodão sem tag"],
  [/guardanapo.*hot/, "Guardanapo com hot stamping"],
  [/guardanapo/, "Guardanapo de algodão com tag"],
  [/passadeira/, "Passadeira"],
  [/avental.*(foto|garcom)/, "Avental com foto"],
  [/avental/, "Avental bordado / premium"],
  [/cartonad/, "Caixa cartonada"],
  [/tags?.*nome/, "Tag com nome do convidado"],
  [/tags? acrilico/, "Tag acrílico"],
  [/tags?.*(sacola|ecobag)/, "Tag de sacola / ecobag"],
  [/tags?.*(papel|bolsa)/, "Tag de papel para bolsa"],
  [/^tags?$|^tags? \(|tag recebida/, "Tag (outras)"],
  [/lacre/, "Lacre"],
  [/gorgur/, "Alça gorgurão"],
  [/sacola.*gg/, "Sacola GG"],
  [/sacola/, "Sacola G"],
  [/hot ?stamping|\bhot\b/, "Hot stamping (adicional)"],
  [/(caixa|caixinha|caiixa|cx).*acril/, "Caixa de acrílico"],
  [/bolsa.*bia/, "Bolsa Bia"],
  [/bolsa.*milla/, "Bolsa Milla"],
  [/bolsa.*gabi/, "Bolsa Gabi"],
  [/bolsa.*letic/, "Bolsa Letícia"],
  [/bolsa.*ana lu/, "Bolsa Ana Luísa"],
  [/n?e?cessaire.*clara/, "Necessaire Clara"],
  [/n?e?cessaire.*letic/, "Necessaire Letícia"],
  [/n?e?cessaire.*luiza/, "Necessaire Luiza"],
  [/mini hel/, "Necessaire Mini Helô"],
  [/jami.*menor/, "Necessaire Jami menor"],
  [/jami/, "Necessaire Jami"],
  [/gloss|lip ?b/, "Gloss / lip balm"],
  [/havaian/, "Havaiana"],
  [/chinel|rasteira/, "Chinela personalizada"],
  [/bone|dad hat/, "Boné"],
  [/oculos/, "Óculos / adesivo de óculos"],
  [/pulseira/, "Pulseira LED"],
  [/bast(ao|oes) de led/, "Bastão de LED"],
  [/ecobag/, "Ecobag"],
  [/banheira/, "Banheira"],
  [/champanheira/, "Champanheira"],
  [/balde/, "Balde de gelo"],
  [/taca.*gin/, "Taça gin"],
  [/beth.*(menor)|mini beth/, "Taça Beth menor"],
  [/beth|elizabeth/, "Taça Beth"],
  [/bohemia/, "Taça Bohemia"],
  [/taca.*vinho/, "Taça de vinho"],
  [/champanhe/, "Taça de champanhe"],
  [/vintage/, "Taça vintage"],
  [/espumante/, "Taça espumante"],
  [/termico|cuia/, "Copo térmico / cuia"],
  [/whisky/, "Copo whisky"],
  [/shot/, "Copo shot"],
  [/copo.*bia/, "Copo Bia"],
  [/pacote|montagem/, "Pacote de montagem"],
  [/abaj|luminaria/, "Abajur / luminária (locação)"],
  [/frete/, "Frete"],
  [/carrinho/, "Carrinho (locação)"],
];
function canon(produto) {
  const s = semAcento(produto);
  for (const [re, nome] of CANON) if (re.test(s)) return nome;
  const t = String(produto).trim();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function agruparMes(lista = FMes()) {
  const G = {};
  lista.forEach(f => f.itens.forEach(i => {
    const nome = canon(i.produto);
    const g = G[nome] = G[nome] || { nome, itens: [], qtd: 0, valor: 0, cats: {}, evs: {}, forn: {}, st: {}, formandos: new Set() };
    g.itens.push(i);
    g.qtd += i.qtd || 0;
    g.valor += i.vt || 0;
    g.cats[i.cat] = (g.cats[i.cat] || 0) + 1;
    g.evs[f.ev] = (g.evs[f.ev] || 0) + (i.qtd || 0);
    const fk = i.fornId ? SUP[i.fornId] : i.escolher ? "a escolher" : "—";
    g.forn[fk] = (g.forn[fk] || 0) + (i.qtd || 0);
    g.st[i.status] = (g.st[i.status] || 0) + (i.qtd || 0);
    g.formandos.add(f.id);
  }));
  return Object.values(G).map(g => ({ ...g, cat: Object.entries(g.cats).sort((a, b) => b[1] - a[1])[0][0] }));
}

const abertosRs = new Set();
function renderResumo() {
  const main = document.getElementById("main");
  const fornNomes = Object.values(SUP).sort((a, b) => a.localeCompare(b, "pt-BR"));
  main.innerHTML = `
    <div class="evhead"><span class="eyebrow">Resumo do mês · ${esc(rotuloMes())}</span><h2>Cada item no mês</h2>
      <p class="hint">Cada produto somado em todos os eventos ${MES_SEL === "todos" ? "de todos os meses" : "de " + esc(rotuloMes().toLowerCase())}, com quantidade, eventos, fornecedor e status. Abra um produto para ver a lista de formandos.</p></div>
    <div class="tools">
      <input id="rq" type="search" placeholder="Buscar produto" aria-label="Buscar produto">
      <select id="rcat" aria-label="Categoria"><option value="">Todas as categorias</option>${CAT_ORDER.map(c => `<option value="${c}">${CAT[c]}</option>`).join("")}</select>
      <select id="rfo" aria-label="Fornecedor"><option value="">Todos os fornecedores</option><option value="a escolher">Fornecedor a escolher</option>${fornNomes.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select>
      <select id="rst" aria-label="Status"><option value="">Todos os status</option>${STATUS.map(([k, l]) => `<option value="${k}">Com itens: ${l}</option>`).join("")}</select>
      <select id="rord" aria-label="Ordenar"><option value="qtd">Maior quantidade</option><option value="valor">Maior valor</option><option value="nome">Nome</option></select>
    </div>
    <div class="count" id="rcount"></div>
    <div class="rs-list" id="rlist"></div>`;
  const rq = document.getElementById("rq"), rcat = document.getElementById("rcat"), rfo = document.getElementById("rfo"), rst = document.getElementById("rst"), rord = document.getElementById("rord");
  const draw = () => {
    const termo = semAcento(rq.value);
    let gs = agruparMes().filter(g =>
      (!termo || semAcento(g.nome).includes(termo) || g.itens.some(i => semAcento(i.produto).includes(termo))) &&
      (!rcat.value || g.cat === rcat.value) &&
      (!rfo.value || g.forn[rfo.value]) &&
      (!rst.value || g.st[rst.value]));
    const ord = rord.value;
    gs.sort((a, b) => ord === "nome" ? a.nome.localeCompare(b.nome, "pt-BR") : ord === "valor" ? b.valor - a.valor : b.qtd - a.qtd);
    document.getElementById("rcount").textContent = `${gs.length} produtos · ${int(gs.reduce((a, g) => a + g.qtd, 0))} unidades · ${brl(gs.reduce((a, g) => a + g.valor, 0))}`;
    const out = [];
    CAT_ORDER.forEach(c => {
      const l = gs.filter(g => g.cat === c);
      if (!l.length) return;
      out.push(`<div class="cathead"><h3>${CAT[c]}</h3><span>${l.length} produtos · ${int(l.reduce((a, g) => a + g.qtd, 0))} un. · ${brl(l.reduce((a, g) => a + g.valor, 0))}</span></div>`);
      l.forEach(g => out.push(rsCard(g)));
    });
    const list = document.getElementById("rlist");
    list.innerHTML = out.length ? out.join("") : `<div class="empty">Nenhum produto com esses filtros.</div>`;
    list.querySelectorAll("details.rs").forEach(d => d.addEventListener("toggle", () => { d.open ? abertosRs.add(d.dataset.k) : abertosRs.delete(d.dataset.k); }));
  };
  [rq, rcat, rfo, rst, rord].forEach(el => el.addEventListener(el === rq ? "input" : "change", draw));
  draw();
}

function rsCard(g) {
  const tot = g.qtd || 1;
  const evs = EVENTOS.filter(e => g.evs[e.id]).map(e => `<span class="ev">${esc(e.nome.replace(/^Pré /, ""))} <b>${int(g.evs[e.id])}</b></span>`).join("");
  const forn = Object.entries(g.forn).sort((a, b) => b[1] - a[1]).map(([n, q]) => `${n} ${int(q)}`).join(" · ");
  const stbar = STATUS.map(([k, l, c]) => g.st[k] ? `<i style="width:${g.st[k] / tot * 100}%;background:${c}" title="${l}: ${g.st[k]}"></i>` : "").join("");
  const stTxt = STATUS.filter(([k]) => g.st[k]).map(([k, l]) => `${l} ${int(g.st[k])}`).join(" · ");
  const linhas = g.itens.slice().sort((a, b) => {
    const ea = EVENTOS.findIndex(e => e.id === (FO_INFO[a.fo] || {}).ev), eb = EVENTOS.findIndex(e => e.id === (FO_INFO[b.fo] || {}).ev);
    return ea - eb || ((FO_INFO[a.fo] || {}).nome || "").localeCompare((FO_INFO[b.fo] || {}).nome || "", "pt-BR");
  }).map(i => {
    const info = FO_INFO[i.fo] || {}, ev = EVENTOS.find(e => e.id === info.ev);
    const forn = i.fornId ? esc(SUP[i.fornId]) : i.escolher ? `<span class="chip warn">escolher</span>` : `<span class="forn-none">—</span>`;
    return `<tr><td class="fo-n">${esc(info.nome)}</td><td>${ev ? `${esc(ev.nome)} <span class="muted num">${ev.data.slice(0, 5)}</span>` : ""}</td><td>${esc(i.produto)}</td><td class="r num">${int(i.qtd)}</td><td>${forn}</td><td class="num">${i.pedido ? fmtData(i.pedido) : `<span class="forn-none">—</span>`}</td><td><span class="chip st-${esc(i.status)}">${esc(STATUS_LABEL[i.status] || i.status)}</span></td><td class="r num">${i.brinde ? `<span class="chip gift">brinde</span>` : i.vt == null ? "—" : brl(i.vt)}</td></tr>`;
  }).join("");
  return `<details class="rs" data-k="${esc(g.nome)}"${abertosRs.has(g.nome) ? " open" : ""}>
    <summary>
      <span class="car" aria-hidden="true"></span>
      <span><span class="nm">${esc(g.nome)}</span><span class="sub">${g.formandos.size} formando${g.formandos.size > 1 ? "s" : ""} · ${g.itens.length} ${g.itens.length > 1 ? "linhas" : "linha"}</span></span>
      <span class="q">${int(g.qtd)}<small>unidades</small></span>
      <span class="mini"><span class="evs">${evs}</span><span class="t" title="${esc(forn)}">${esc(forn)}</span></span>
      <span class="mini"><span class="stbar">${stbar}</span><span class="t" title="${esc(stTxt)}">${esc(stTxt)}</span></span>
      <span class="v hide-sm">${brl(g.valor)}</span>
    </summary>
    <div class="body">
      <div class="facts"><span>Total <b>${int(g.qtd)}</b> un.</span><span>Valor <b>${brl(g.valor)}</b></span><span>Fornecedores: ${esc(forn)}</span><span>Com pedido enviado <b>${int(g.itens.filter(i => i.pedido).reduce((a, i) => a + (i.qtd || 0), 0))}</b> de ${int(g.qtd)} un.</span></div>
      <div class="tablebox"><table>
        <thead><tr><th>Formando</th><th>Evento</th><th>Como está no orçamento</th><th class="r">Qtd</th><th>Fornecedor</th><th>Pedido ao fornecedor</th><th>Status</th><th class="r">Total</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>
    </div>
  </details>`;
}

/* ---------- Abas: por formando / produção ---------- */
let aba = "producao";
const sel = new Set();
const tabsHtml = () => `<div class="tabs" role="tablist">
  <button class="tab" role="tab" type="button" data-aba="producao" aria-selected="${aba === "producao"}">Produção · mudar status</button>
  <button class="tab" role="tab" type="button" data-aba="formandos" aria-selected="${aba === "formandos"}">Por formando</button>
</div>`;
const roCallout = () => `<div class="callout ro">Somente leitura: a edição não está disponível nesta visualização, por isso os menus de fornecedor e status não aparecem. Veja o motivo na faixa do topo.</div>`;

function renderTab() {
  const tb = document.getElementById("tabbody");
  if (aba === "formandos") {
    tb.innerHTML = `${LIVE ? `<div class="callout">Abra um formando para ver todos os itens dele e mudar fornecedor e status de cada um.</div>` : roCallout()}
      ${toolsHtml(atual === "geral" ? "Buscar formando, item ou fornecedor em todos os eventos" : "Buscar formando, item ou fornecedor")}
      <div class="list" id="list"></div>`;
    wireList();
  } else {
    renderProd();
  }
}

function prodRow(i, flash) {
  const info = FO_INFO[i.fo] || {};
  const ev = EVENTOS.find(e => e.id === info.ev);
  const cls = [sel.has(i.id) ? "sel" : "", flash ? `flash-${flash[0]}` : ""].filter(Boolean).join(" ");
  return `<tr data-row="${esc(i.id)}" data-view="prod"${cls ? ` class="${cls}"` : ""}>
    ${LIVE ? `<td class="ck"><input type="checkbox" data-ck="${esc(i.id)}" aria-label="Selecionar ${esc(i.produto)} de ${esc(info.nome)}"${sel.has(i.id) ? " checked" : ""}></td>` : ""}
    <td class="fo-n">${esc(info.nome)}${atual === "geral" && ev ? `<span class="sub">${esc(ev.nome)} ${ev.data.slice(0, 5)}</span>` : ""}</td>
    <td class="prod">${esc(i.produto)}</td>
    <td class="r num">${int(i.qtd)}</td>
    <td>${fornCell(i)}${flashEm(flash, "forn")}</td>
    <td>${pedidoCell(i)}${flashEm(flash, "pedido")}${flashEm(flash, "codigo")}</td>
    <td>${statusCell(i)}${flashEm(flash, "status")}${localCell(i, flash)}</td>
    <td class="obs">${obsCell(i, flash)}</td>
  </tr>`;
}

function renderProd() {
  const tb = document.getElementById("tabbody");
  const fornOpts = Object.entries(SUP).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  tb.innerHTML = `
    ${LIVE ? `<div class="callout">Mude o status direto na linha, ou marque vários itens e use a barra abaixo para mudar todos de uma vez. Cada mudança fica salva na hora.</div>` : roCallout()}
    <div class="tools">
      <input id="pq" type="search" placeholder="Buscar item, formando, fornecedor, nº do pedido ou cor" aria-label="Buscar item">
      <select id="pst" aria-label="Filtrar por status"><option value="">Todos os status</option>${STATUS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
      <select id="pfo" aria-label="Filtrar por fornecedor"><option value="">Todos os fornecedores</option><option value="__escolher">Fornecedor a escolher</option>${fornOpts.map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join("")}</select>
      <select id="pcat" aria-label="Filtrar por categoria"><option value="__prod">Itens de produção</option><option value="">Todos os itens</option>${CAT_ORDER.map(c => `<option value="${c}">${CAT[c]}</option>`).join("")}</select>
      <select id="pped" aria-label="Filtrar por pedido ao fornecedor"><option value="">Pedido: todos</option><option value="sem">Sem pedido enviado</option><option value="com">Com pedido enviado</option></select>
    </div>
    ${LIVE ? `<div class="bulk" id="bulk" data-n="0">
      <span><b id="nsel" class="num">0</b> selecionados</span>
      <span class="sep" aria-hidden="true"></span>
      <label for="bst">Status</label>
      <select id="bst">${STATUS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
      <button class="btn" type="button" id="bstgo" disabled>Aplicar status</button>
      <span class="sep" aria-hidden="true"></span>
      <label for="bfo">Fornecedor</label>
      <select id="bfo"><option value="">— sem fornecedor —</option>${fornOpts.map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join("")}</select>
      <button class="btn" type="button" id="bfogo" disabled>Aplicar fornecedor</button>
      <span class="sep" aria-hidden="true"></span>
      <label for="bdt">Pedido enviado em</label>
      <input type="date" id="bdt">
      <button class="btn" type="button" id="bdtgo" disabled>Aplicar data</button>
      <span class="sep" aria-hidden="true"></span>
      <label for="bcd">Nº pedido Império</label>
      <input type="text" id="bcd" maxlength="40" placeholder="ex.: 10773" style="width:110px">
      <button class="btn" type="button" id="bcdgo" disabled>Aplicar código</button>
      <button class="btn" type="button" id="bclr" disabled>Limpar seleção</button>
      <span class="res" id="bres" role="status"></span>
    </div>` : ""}
    <div class="count" id="pcount"></div>
    <div class="tablebox"><table>
      <thead><tr>${LIVE ? `<th class="ck"><input type="checkbox" id="ckall" aria-label="Selecionar todos os itens da lista"></th>` : ""}<th>Formando</th><th>Item</th><th class="r">Qtd</th><th>Fornecedor</th><th>Pedido ao fornecedor</th><th>Status</th><th>Observação</th></tr></thead>
      <tbody id="prows"></tbody>
    </table></div>`;

  const pq = document.getElementById("pq"), pst = document.getElementById("pst"), pfo = document.getElementById("pfo"), pcat = document.getElementById("pcat"), pped = document.getElementById("pped");
  const body = document.getElementById("prows");
  let visiveis = [];
  const updBulk = () => {
    const b = document.getElementById("bulk");
    if (!b) return;
    b.dataset.n = String(sel.size);
    document.getElementById("nsel").textContent = sel.size;
    ["bstgo", "bfogo", "bdtgo", "bcdgo", "bclr"].forEach(id => { document.getElementById(id).disabled = sel.size === 0; });
    const all = document.getElementById("ckall");
    if (all) { const n = visiveis.filter(i => sel.has(i.id)).length; all.checked = n > 0 && n === visiveis.length; all.indeterminate = n > 0 && n < visiveis.length; }
  };
  const draw = () => {
    const base = atual === "geral" ? FMes() : byEv(EVENTOS.find(x => x.slug === atual).id);
    const termo = pq.value.trim().toLowerCase();
    visiveis = allItens(base).filter(i => {
      if (pcat.value === "__prod" && !PRODUCAO.has(i.cat)) return false;
      if (pcat.value && pcat.value !== "__prod" && i.cat !== pcat.value) return false;
      if (pst.value && i.status !== pst.value) return false;
      if (pped.value === "sem" && i.pedido) return false;
      if (pped.value === "com" && !i.pedido) return false;
      if (pfo.value === "__escolher" && !i.escolher) return false;
      if (pfo.value && pfo.value !== "__escolher" && i.fornId !== pfo.value) return false;
      if (termo) {
        const nome = (FO_INFO[i.fo] || {}).nome || "";
        if (!(i.produto.toLowerCase().includes(termo) || nome.toLowerCase().includes(termo) || (SUP[i.fornId] || "").toLowerCase().includes(termo) || (i.codigo || "").toLowerCase().includes(termo) || (i.cores || "").toLowerCase().includes(termo))) return false;
      }
      return true;
    }).sort((a, b) => ((FO_INFO[a.fo] || {}).nome || "").localeCompare((FO_INFO[b.fo] || {}).nome || "", "pt-BR") || CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat));
    document.getElementById("pcount").textContent = `${int(visiveis.length)} ${visiveis.length === 1 ? "item" : "itens"} na lista`;
    body.innerHTML = visiveis.length ? visiveis.map(i => prodRow(i)).join("") : `<tr><td colspan="8" class="muted">Nenhum item com esses filtros.</td></tr>`;
    updBulk();
  };
  [pq, pst, pfo, pcat, pped].forEach(el => el.addEventListener(el === pq ? "input" : "change", draw));

  body.addEventListener("change", ev => {
    const ck = ev.target.closest("input[data-ck]");
    if (ck) {
      ck.checked ? sel.add(ck.dataset.ck) : sel.delete(ck.dataset.ck);
      ck.closest("tr").classList.toggle("sel", ck.checked);
      updBulk(); return;
    }
    const s = ev.target.closest(".ed");
    if (!s) return;
    const tr = s.closest("tr");
    tr.dataset.lastCampo = s.dataset.campo;
    salvarItem(s.dataset.item, s.dataset.campo, s.value, tr);
  });

  if (LIVE) {
    document.getElementById("ckall").addEventListener("change", e => {
      visiveis.forEach(i => e.target.checked ? sel.add(i.id) : sel.delete(i.id));
      body.querySelectorAll("input[data-ck]").forEach(c => { c.checked = e.target.checked; c.closest("tr").classList.toggle("sel", e.target.checked); });
      updBulk();
    });
    document.getElementById("bclr").addEventListener("click", () => { sel.clear(); draw(); });
    const aplicar = async (campo, valor, rotulo) => {
      const res = document.getElementById("bres");
      const ids = [...sel];
      ["bstgo", "bfogo", "bdtgo", "bcdgo", "bclr"].forEach(id => { document.getElementById(id).disabled = true; });
      res.className = "res"; res.textContent = `Salvando ${ids.length} itens…`;
      const r = await salvarLote(ids, campo, valor, (n, tot) => { res.textContent = `Salvando ${n} de ${tot}…`; });
      if (r.ok) { sel.clear(); res.className = "res ok"; res.textContent = `${r.n} ${r.n === 1 ? "item atualizado" : "itens atualizados"}: ${rotulo}.`; }
      else { res.className = "res err"; res.textContent = r.msg; }
      draw(); refreshResumo();
    };
    document.getElementById("bstgo").addEventListener("click", () => { const v = document.getElementById("bst").value; aplicar("status", v, STATUS_LABEL[v]); });
    document.getElementById("bfogo").addEventListener("click", () => { const v = document.getElementById("bfo").value; aplicar("forn", v, v ? SUP[v] : "sem fornecedor"); });
    document.getElementById("bdtgo").addEventListener("click", () => { const v = document.getElementById("bdt").value; aplicar("pedido", v, v ? `pedido enviado em ${fmtData(v)}` : "data do pedido apagada"); });
    document.getElementById("bcdgo").addEventListener("click", () => {
      const v = document.getElementById("bcd").value.trim(), res = document.getElementById("bres");
      const fora = [...sel].filter(id => ITEM[id] && !ehImperio(ITEM[id].fornId));
      if (fora.length === sel.size) { res.className = "res err"; res.textContent = "Nenhum item selecionado é da Império. Escolha a Império como fornecedor primeiro."; return; }
      fora.forEach(id => sel.delete(id));
      aplicar("codigo", v, (v ? `código do pedido ${v}` : "código do pedido apagado") + (fora.length ? ` (${fora.length} de outro fornecedor ficaram de fora)` : ""));
    });
  }
  draw();
}

function wireList() {
  const q = document.getElementById("q"), sit = document.getElementById("sit"), list = document.getElementById("list");
  const draw = () => {
    const base = atual === "geral" ? FMes() : byEv(EVENTOS.find(x => x.slug === atual).id);
    const termo = q.value.trim().toLowerCase();
    if (atual === "geral" && !termo && sit.value === "all") {
      list.innerHTML = `<div class="empty">Digite um nome, item ou fornecedor, ou escolha um filtro, para listar formandos de todos os eventos. Para ver um evento inteiro, abra a pasta dele.</div>`;
      return;
    }
    const r = filtrar(base, termo, sit.value);
    list.innerHTML = r.length ? r.map(f => foCard(f, sit.value, atual === "geral")).join("") : `<div class="empty">Nenhum formando com esse filtro.</div>`;
    list.querySelectorAll("details.fo").forEach(d => d.addEventListener("toggle", () => { d.open ? abertos.add(d.dataset.id) : abertos.delete(d.dataset.id); }));
  };
  q.addEventListener("input", draw);
  sit.addEventListener("change", draw);
  document.getElementById("expand").addEventListener("click", () => list.querySelectorAll("details.fo").forEach(d => { d.open = true; }));
  document.getElementById("collapse").addEventListener("click", () => list.querySelectorAll("details.fo").forEach(d => { d.open = false; }));
  list.addEventListener("change", ev => {
    const oc = ev.target.closest("textarea[data-obscat]");
    if (oc) { salvarObsCat(oc); return; }
    const s = ev.target.closest(".ed");
    if (!s) return;
    const tr = s.closest("tr");
    tr.dataset.lastCampo = s.dataset.campo;
    salvarItem(s.dataset.item, s.dataset.campo, s.value, tr);
  });
  list.addEventListener("submit", ev => { const fm = ev.target.closest("form[data-pgform]"); if (fm) { ev.preventDefault(); salvarPagamento(fm); } });
  list.addEventListener("click", ev => { const b = ev.target.closest("[data-pgdel], [data-pgpago]"); if (b) acaoPagamento(b); });
  garantirListaRecebedor();
  draw();
}


/* ---------- Entrar, recuperar senha e abrir o painel ---------- */
const PAGINAS = ["agenda", "geral", "resumo", "novo", "lucro", "estoque", "compras", "organizar"];

// Opções do seletor de mês, conforme as datas dos eventos carregados
function preencherMeses() {
  const sel = document.getElementById("mesSel");
  const ms = mesesDisponiveis();
  if (MES_SEL !== "todos" && !ms.includes(MES_SEL)) MES_SEL = "todos";
  sel.innerHTML = `<option value="todos">Todos os meses</option>` + ms.map(m => `<option value="${m}">${esc(rotuloDe(m))}</option>`).join("");
  sel.value = MES_SEL;
}
document.getElementById("mesSel").addEventListener("change", e => {
  MES_SEL = e.target.value;
  try { localStorage.setItem("mcm-mes", MES_SEL); } catch (err) {}
  renderFolders(); render();
});
const hInicial = /^#[A-Za-z0-9_-]+$/.test(HASH_INICIAL) ? HASH_INICIAL.slice(1) : "";
const elBoot = document.getElementById("boot"), elAuth = document.getElementById("auth"), elApp = document.getElementById("app");
let abrindo = false;

function mostrarAuth(view, texto, tipo) {
  elBoot.hidden = true; elApp.hidden = true; elAuth.hidden = false;
  elAuth.querySelectorAll("[data-view]").forEach(v => { v.hidden = v.dataset.view !== view; });
  const box = elAuth.querySelector(`[data-view="${view}"]`);
  elAuth.querySelectorAll(".auth-msg").forEach(m => { m.textContent = ""; m.className = "auth-msg"; });
  if (texto) avisar(box, texto, tipo || "info");
  const primeiro = box.querySelector("input:not([value]), input");
  if (primeiro) setTimeout(() => { if (!primeiro.value) primeiro.focus(); }, 0);
}
function avisar(form, texto, tipo) {
  const m = form.querySelector(".auth-msg");
  if (m) { m.className = "auth-msg " + tipo; m.textContent = texto; }
}
function ocupado(form, sim, rotulo) {
  const b = form.querySelector('button[type="submit"]');
  if (!b) return;
  if (sim) { b.dataset.rotulo = b.textContent; b.textContent = rotulo; b.disabled = true; }
  else { b.textContent = b.dataset.rotulo || b.textContent; b.disabled = false; }
}
const emailOk = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
function erroAuth(e) {
  const m = String((e && e.message) || "");
  const s = e && e.status;
  if (/invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(m)) return "Este e-mail ainda não foi confirmado. Abra o e-mail de confirmação que a conta recebeu.";
  if (/token has expired|invalid.*(otp|token)|otp.*(expired|invalid)/i.test(m)) return "Código inválido ou vencido. Peça um e-mail novo e use o código mais recente.";
  if (s === 429 || /rate limit|too many|security purposes/i.test(m)) return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
  if (/should be different|same password/i.test(m)) return "A nova senha precisa ser diferente da anterior.";
  if (/password should be|weak/i.test(m)) return "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.";
  if (/fetch|network|failed to/i.test(m)) return "Sem conexão com o servidor. Confira a internet e tente de novo.";
  return "Não deu certo: " + (m || "erro desconhecido") + ".";
}
function conferirSenhas(a, b) {
  if (a.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (a !== b) return "As duas senhas não são iguais.";
  return "";
}

async function abrirPainel(session) {
  if (abrindo) return;
  abrindo = true;
  try {
    USER = session.user;
    const { data, error } = await sb.from("membros").select("email").limit(1);
    if (error || !data || !data.length) {
      document.getElementById("saEmail").textContent = USER.email || "";
      mostrarAuth("semacesso");
      return;
    }
    elBoot.hidden = true; elAuth.hidden = true; elApp.hidden = false;
    document.getElementById("quem").textContent = USER.email || "";
    setConn("loading", "Carregando eventos, formandos e itens…");
    document.getElementById("folders").innerHTML = "";
    document.getElementById("main").innerHTML = `<div class="empty">Carregando os dados do banco…</div>`;
    await carregar();
    LIVE = true;
    if (hInicial && (PAGINAS.includes(hInicial) || EVENTOS.some(e => e.slug === hInicial))) atual = hInicial;
    { const ev = EVENTOS.find(e => e.slug === atual); if (ev) mesesAbertos.add(mesDe(ev)); }
    preencherMeses();
    connMsg(); renderFolders(); render();
  } catch (e) {
    LIVE = false;
    setConn("error", `<b>Não carregou.</b> ${esc(erroDb(e))}. <button class="btn" type="button" id="recarregar">Tentar de novo</button>`);
    const b = document.getElementById("recarregar");
    if (b) b.addEventListener("click", recarregar);
  } finally {
    abrindo = false;
  }
}

// Troca de etapa pelos links
elAuth.addEventListener("click", e => {
  const ir = e.target.closest("[data-ir]");
  if (!ir) return;
  const view = ir.dataset.ir;
  const email = (document.getElementById("enEmail").value || document.getElementById("esEmail").value || document.getElementById("coEmail").value).trim();
  if (view === "esqueci") document.getElementById("esEmail").value = email;
  if (view === "codigo") document.getElementById("coEmail").value = email;
  if (view === "entrar") document.getElementById("enEmail").value = email;
  mostrarAuth(view);
});
document.querySelectorAll("[data-sair]").forEach(b => b.addEventListener("click", async () => {
  b.disabled = true;
  await sb.auth.signOut();
  b.disabled = false;
  LIVE = false; USER = null;
  mostrarAuth("entrar", "Você saiu do painel.", "info");
}));

// Entrar
document.getElementById("fEntrar").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.currentTarget;
  const email = document.getElementById("enEmail").value.trim(), senha = document.getElementById("enSenha").value;
  if (!emailOk(email)) return avisar(f, "Digite um e-mail válido.", "err");
  if (!senha) return avisar(f, "Digite a senha.", "err");
  ocupado(f, true, "Entrando…");
  const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
  ocupado(f, false);
  if (error) return avisar(f, erroAuth(error), "err");
  document.getElementById("enSenha").value = "";
  abrirPainel(data.session);
});

// Esqueci minha senha: envia o e-mail com link e código
document.getElementById("fEsqueci").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.currentTarget;
  const email = document.getElementById("esEmail").value.trim();
  if (!emailOk(email)) return avisar(f, "Digite um e-mail válido.", "err");
  ocupado(f, true, "Enviando…");
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  ocupado(f, false);
  if (error) return avisar(f, erroAuth(error), "err");
  document.getElementById("coEmail").value = email;
  mostrarAuth("codigo", `Se ${email} tiver uma conta, o e-mail de recuperação chega em alguns minutos. Confira também a caixa de spam.`, "ok");
});

// Código do e-mail + nova senha
document.getElementById("fCodigo").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.currentTarget;
  const email = document.getElementById("coEmail").value.trim();
  const token = document.getElementById("coCodigo").value.replace(/\s+/g, "");
  const s1 = document.getElementById("coSenha").value, s2 = document.getElementById("coSenha2").value;
  if (!emailOk(email)) return avisar(f, "Digite o e-mail da conta.", "err");
  if (!/^\d{6,10}$/.test(token)) return avisar(f, "Digite o código numérico que veio no e-mail.", "err");
  const prob = conferirSenhas(s1, s2);
  if (prob) return avisar(f, prob, "err");
  ocupado(f, true, "Conferindo o código…");
  const v = await sb.auth.verifyOtp({ email, token, type: "recovery" });
  if (v.error) { ocupado(f, false); return avisar(f, erroAuth(v.error), "err"); }
  const u = await sb.auth.updateUser({ password: s1 });
  ocupado(f, false);
  if (u.error) return avisar(f, erroAuth(u.error), "err");
  ["coCodigo", "coSenha", "coSenha2"].forEach(id => { document.getElementById(id).value = ""; });
  const { data } = await sb.auth.getSession();
  abrirPainel(data.session);
});

// Nova senha depois de abrir o link do e-mail
document.getElementById("fNova").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.currentTarget;
  const s1 = document.getElementById("nvSenha").value, s2 = document.getElementById("nvSenha2").value;
  const prob = conferirSenhas(s1, s2);
  if (prob) return avisar(f, prob, "err");
  ocupado(f, true, "Salvando…");
  const u = await sb.auth.updateUser({ password: s1 });
  ocupado(f, false);
  if (u.error) return avisar(f, erroAuth(u.error), "err");
  ["nvSenha", "nvSenha2"].forEach(id => { document.getElementById(id).value = ""; });
  try { history.replaceState(null, "", location.pathname); } catch (err) {}
  const { data } = await sb.auth.getSession();
  abrirPainel(data.session);
});

// Link de recuperação: o Supabase avisa com PASSWORD_RECOVERY
let recuperando = /type=recovery/.test(HASH_INICIAL);
const erroNoLink = /error_code=|error=/.test(HASH_INICIAL) ? decodeURIComponent((HASH_INICIAL.match(/error_description=([^&]+)/) || [])[1] || "erro").replace(/\+/g, " ") : "";
sb.auth.onAuthStateChange((evento) => {
  if (evento === "PASSWORD_RECOVERY") { recuperando = true; setTimeout(() => mostrarAuth("nova"), 0); }
});

(async () => {
  if (erroNoLink) {
    try { history.replaceState(null, "", location.pathname); } catch (e) {}
    mostrarAuth("esqueci", /expired|invalid/i.test(erroNoLink) ? "Esse link de recuperação venceu ou já foi usado. Peça um novo abaixo." : "O link não funcionou: " + erroNoLink, "err");
    return;
  }
  const { data } = await sb.auth.getSession();
  if (recuperando) { if (data.session) mostrarAuth("nova"); return; }
  if (data.session) abrirPainel(data.session);
  else mostrarAuth("entrar");
})();
