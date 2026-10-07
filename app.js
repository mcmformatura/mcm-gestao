"use strict";
/* MCM Gestão: painel de eventos, formandos e produção, com dados e login no Supabase */
const SUPABASE_URL = "https://ktibfvbsijtusbhkrlaq.supabase.co";
const SUPABASE_KEY = "sb_publishable_8kpS_xm27R8z_DNA4iSnWQ_pK92xkRh";   // chave pública; o acesso aos dados é controlado no banco (RLS)
const HASH_INICIAL = location.hash || "";   // lido antes do Supabase limpar o link de recuperação
const sb = window.MCM_LOCAL ? window.MCM_LOCAL.client : supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
});

const EVENTOS = [];          // carregados do banco
const DATA_OK = /^\d{4}-\d{2}-\d{2}$/;
const fmtData = d => DATA_OK.test(d || "") ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "";

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


/* ---------- Estado ---------- */
let LIVE = false;           // dados carregados e edição liberada
let USER = null;            // usuário conectado
let SUP = {};               // id do fornecedor -> nome
let SUP_BY_NAME = {};       // nome -> id
let F = [];                 // formandos com itens e pagamentos
let ITEM = {};              // id -> item
let FO_INFO = {};           // id do formando -> { nome, ev }
const PEDIDOS = {};         // id do pedido -> pedido lançado pelo painel

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
  const [evs, fos, its, pgs, sups, cus, peds] = await Promise.all([
    todos("eventos", "id,nome,data,slug,ordem", ["ordem", "data", "nome"]),
    todos("formandos", "id,evento_id,nome", ["nome", "id"]),
    todos("itens", "id,formando_id,pedido_id,ordem,produto,fornecedor_id,qtd,valor_unit,valor_total,categoria,brinde,obs,status,pedido_em", ["formando_id", "ordem", "id"]),
    todos("pagamentos", "id,formando_id,ordem,descricao,valor,data,status,tipo,obs", ["formando_id", "ordem", "id"]),
    todos("fornecedores", "id,nome", ["nome"]),
    todos("custos", "chave,produto,custo,venda", ["chave"]),
    todos("pedidos", "id,formando_id,formando_novo,total,criado_em", ["criado_em"]),
  ]);
  const n = v => v == null ? null : +v;

  EVENTOS.length = 0;
  evs.forEach(e => EVENTOS.push({ id: e.id, nome: e.nome, data: fmtData(e.data) || "", slug: e.slug }));

  SUP = {}; SUP_BY_NAME = {};
  sups.forEach(s => { SUP[s.id] = s.nome; SUP_BY_NAME[s.nome] = s.id; });

  Object.keys(CUSTOS).forEach(k => { delete CUSTOS[k]; });
  cus.forEach(c => { CUSTOS[c.chave] = { produto: c.produto, custo: n(c.custo), venda: n(c.venda) }; });

  ITEM = {}; FO_INFO = {};
  const porFo = {}, porPedido = {};
  its.forEach(r => {
    const it = {
      id: r.id, fo: r.formando_id, produto: r.produto, fornId: r.fornecedor_id && SUP[r.fornecedor_id] ? r.fornecedor_id : null,
      qtd: +r.qtd || 0, vu: n(r.valor_unit), vt: n(r.valor_total), cat: CAT[r.categoria] ? r.categoria : "OUTROS",
      brinde: !!r.brinde, obs: r.obs || "", status: r.status, pedido: r.pedido_em || "", novo: !!r.pedido_id,
    };
    ITEM[it.id] = it;
    (porFo[it.fo] = porFo[it.fo] || []).push(it);
    if (r.pedido_id) (porPedido[r.pedido_id] = porPedido[r.pedido_id] || []).push(it);
  });
  const pgPorFo = {};
  pgs.forEach(p => {
    (pgPorFo[p.formando_id] = pgPorFo[p.formando_id] || []).push({ desc: p.descricao || "", valor: +p.valor || 0, data: p.data, status: p.status, tipo: p.tipo, obs: p.obs || "" });
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
  try { await carregar(); LIVE = true; connMsg(); renderFolders(); render(); }
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
function novoEstado(it, campo, valor) {
  const pedido = it.pedido || "";
  if (campo === "forn") { if (valor && !SUP[valor]) return null; return { status: it.status, fornId: valor || null, pedido }; }
  if (campo === "status") { if (!STATUS_LABEL[valor]) return null; return { status: valor, fornId: it.fornId, pedido }; }
  if (campo === "pedido") {
    if (valor && !DATA_OK.test(valor)) return null;
    // Ao registrar o pedido, um item ainda "aguardando produção" passa para "repassado ao fornecedor"
    const status = valor && it.status === "AGUARDANDO_PRODUCAO" ? "REPASSADO" : it.status;
    return { status, fornId: it.fornId, pedido: valor || "" };
  }
  return null;
}
async function gravar(it, novo) {
  const { data, error } = await sb.from("itens").update({
    status: novo.status, fornecedor_id: novo.fornId || null, pedido_em: novo.pedido || null,
    atualizado_em: new Date().toISOString(), atualizado_por: USER ? USER.id : null,
  }).eq("id", it.id).select("id");
  if (error) throw error;
  if (!data || !data.length) throw new Error("nada foi salvo");
  it.status = novo.status; it.fornId = novo.fornId || null; it.pedido = novo.pedido || "";
}

async function salvarItem(itemId, campo, valor, tr) {
  const it = ITEM[itemId];
  if (!it || !LIVE || !SAFE_ID.test(itemId)) return;
  const novo = novoEstado(it, campo, valor);
  if (!novo) return;
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
let atual = "geral";
const abertos = new Set();
const byEv = id => F.filter(f => f.ev === id);
const sum = (arr, k) => arr.reduce((a, x) => a + x[k], 0);
const allItens = lista => lista.flatMap(f => f.itens);

function renderFolders() {
  const nav = document.getElementById("folders");
  const tot = sum(F, "nEscolher");
  const items = [`<button class="folder overview novo" type="button" data-f="novo" aria-current="${atual === "novo"}">${plusIcon}<span class="fn">Novo pedido<span class="fd">lançar itens por setor</span></span><span class="fc">${Object.values(PEDIDOS).filter(p => !p.sync).length || ""}</span></button>`,
    `<button class="folder overview" type="button" data-f="geral" aria-current="${atual === "geral"}">${gridIcon}<span class="fn">Visão geral<span class="fd">todos os eventos</span></span><span class="fc">${F.length}${tot ? `<span class="w">${tot} a escolher</span>` : ""}</span></button>`,
    `<button class="folder overview lucro" type="button" data-f="lucro" aria-current="${atual === "lucro"}">${coinIcon}<span class="fn">Itens e lucro<span class="fd">venda × custo do fornecedor</span></span><span class="fc"></span></button>`,
    `<button class="folder overview" type="button" data-f="resumo" aria-current="${atual === "resumo"}">${listIcon}<span class="fn">Resumo do mês<span class="fd">cada item em dezembro</span></span><span class="fc"></span></button>`];
  EVENTOS.forEach((e, i) => {
    const l = byEv(e.id), w = sum(l, "nEscolher");
    items.push(`<button class="folder${i === 0 ? " sep" : ""}" type="button" data-f="${e.slug}" aria-current="${atual === e.slug}">${folderIcon}<span class="fn">${esc(e.nome)}<span class="fd">${e.data.slice(0, 5)} · ${l.length} formando${l.length > 1 ? "s" : ""}</span></span><span class="fc">${w ? `<span class="w">${w} a escolher</span>` : ""}</span></button>`);
  });
  nav.innerHTML = items.join("");
  nav.querySelectorAll(".folder").forEach(b => b.addEventListener("click", () => abrir(b.dataset.f)));
}

function abrir(slug) {
  atual = slug;
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

function pedidoCell(i) {
  if (!LIVE) return i.pedido ? `<span class="num">${fmtData(i.pedido)}</span>` : `<span class="forn-none">—</span>`;
  return `<input type="date" class="ed dt${i.pedido ? " has" : ""}" data-item="${esc(i.id)}" data-campo="pedido" value="${esc(i.pedido || "")}" aria-label="Data do pedido ao fornecedor de ${esc(i.produto)}">`;
}
// Mensagem de "salvo"/erro aparece embaixo do campo que foi alterado
const flashEm = (flash, campo) => {
  if (!flash) return "";
  const alvo = flash[2] === "forn" || flash[2] === "pedido" ? flash[2] : "status";
  return alvo === campo ? `<span class="rowmsg ${flash[0]}">${esc(flash[1])}</span>` : "";
};

function itemRow(i, flash) {
  const total = i.brinde ? `<span class="chip gift">brinde</span>` : i.vt == null ? `<span class="muted">a definir</span>` : brl(i.vt);
  const obs = String(i.obs || "").replace(/\s*\/?\s*BRINDE$/i, "").trim();
  return `<tr data-row="${esc(i.id)}"${flash ? ` class="flash-${flash[0]}"` : ""}>
    <td class="prod">${esc(i.produto)}</td>
    <td class="r num">${int(i.qtd)}</td>
    <td class="r num">${i.vu == null ? "—" : brl(i.vu)}</td>
    <td>${fornCell(i)}${flashEm(flash, "forn")}</td>
    <td>${pedidoCell(i)}${flashEm(flash, "pedido")}</td>
    <td>${statusCell(i)}${flashEm(flash, "status")}</td>
    <td class="r num">${total}</td>
    <td class="obs">${esc(obs)}</td>
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
  });
  return out.join("");
}

function payList(f) {
  if (!f.pg.length) return `<p class="hint">Nenhum pagamento registrado.</p>`;
  return `<ul>${f.pg.map(p => {
    const chip = p.tipo === "DESCONTO" ? `<span class="chip gift">desconto</span>` : p.status === "PAGO" ? `<span class="chip ok">pago</span>` : `<span class="chip warn">a pagar</span>`;
    return `<li><span class="d">${esc(p.data || "sem data")}</span><span>${chip} ${esc(p.desc)}${p.obs ? ` <span class="muted">· ${esc(p.obs)}</span>` : ""}</span><span class="v">${brl(p.valor)}</span></li>`;
  }).join("")}</ul>`;
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
  if (atual === "lucro") { renderFolders(); return; }
  const k = document.querySelector(".kpis");
  const evAtual = EVENTOS.find(x => x.slug === atual);
  if (k && (atual === "geral" || evAtual)) {
    const lista = atual === "geral" ? F : byEv(evAtual.id);
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
  if (atual !== "geral" && !EVENTOS.some(x => x.slug === atual)) atual = "geral";
  if (atual === "geral") {
    const grupos = {};
    allItens(F).filter(i => i.escolher).forEach(i => {
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
      <div class="evhead"><span class="eyebrow">Visão geral</span><h2>Todos os eventos de dezembro</h2></div>
      ${kpis(F)}
      <div class="evcards">${EVENTOS.map(e => {
        const l = byEv(e.id), d = sum(l, "devido"), p = sum(l, "pago"), w = sum(l, "nEscolher");
        return `<button class="evcard" type="button" data-f="${e.slug}">
          <span class="meta"><span class="nm">${esc(e.nome)}</span><span class="dt">${e.data.slice(0, 5)}</span></span>
          <span class="bar" aria-hidden="true"><i style="width:${d ? (p / d * 100).toFixed(1) : 0}%"></i></span>
          <span class="meta"><span>${l.length} formando${l.length > 1 ? "s" : ""} · ${allItens(l).length} itens</span><span class="num">${d ? Math.round(p / d * 100) : 0}% recebido</span></span>
          ${w ? `<span class="meta"><span class="chip warn">${w} a escolher</span></span>` : ""}
        </button>`;
      }).join("")}</div>
      <div class="two">
        <div id="stpanel">${statusResumo(F)}</div>
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
const novoRascunho = (evId = "") => ({ evId, evNome: "", evData: "", foNome: "", linhas: Object.fromEntries(SETORES.map(c => [c, [linhaVazia()]])) });
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
    const evId = PEDIDOS[pid] && PEDIDOS[pid].evento.id ? PEDIDOS[pid].evento.id : evento.id;
    const evSlug = (EVENTOS.find(e => e.id === evId) || {}).slug;
    RASC = novoRascunho(evId || ""); guardarRascunho();
    renderFolders(); renderNovo();
    const m = document.getElementById("npmsg");
    m.className = "np-msg ok";
    m.innerHTML = `Pedido salvo: ${itens.length} ${itens.length > 1 ? "itens" : "item"} para <b>${esc(foNome)}</b> (${esc(evento.nome)}), ${brl(total)}. ${evSlug ? `<button type="button" class="btn" id="npver">Abrir a pasta do evento</button>` : ""}`;
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
    <div class="evhead"><span class="eyebrow">Itens e lucro · dezembro 2026</span><h2>Quanto ganhamos em cada item</h2>
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

function agruparMes() {
  const G = {};
  F.forEach(f => f.itens.forEach(i => {
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
    <div class="evhead"><span class="eyebrow">Resumo do mês · dezembro 2026</span><h2>Cada item no mês</h2>
      <p class="hint">Cada produto somado em todos os eventos de dezembro, com quantidade, eventos, fornecedor e status. Abra um produto para ver a lista de formandos.</p></div>
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
  const obs = String(i.obs || "").replace(/\s*\/?\s*BRINDE$/i, "").trim();
  const cls = [sel.has(i.id) ? "sel" : "", flash ? `flash-${flash[0]}` : ""].filter(Boolean).join(" ");
  return `<tr data-row="${esc(i.id)}" data-view="prod"${cls ? ` class="${cls}"` : ""}>
    ${LIVE ? `<td class="ck"><input type="checkbox" data-ck="${esc(i.id)}" aria-label="Selecionar ${esc(i.produto)} de ${esc(info.nome)}"${sel.has(i.id) ? " checked" : ""}></td>` : ""}
    <td class="fo-n">${esc(info.nome)}${atual === "geral" && ev ? `<span class="sub">${esc(ev.nome)} ${ev.data.slice(0, 5)}</span>` : ""}</td>
    <td class="prod">${esc(i.produto)}</td>
    <td class="r num">${int(i.qtd)}</td>
    <td>${fornCell(i)}${flashEm(flash, "forn")}</td>
    <td>${pedidoCell(i)}${flashEm(flash, "pedido")}</td>
    <td>${statusCell(i)}${flashEm(flash, "status")}</td>
    <td class="obs">${esc(obs)}</td>
  </tr>`;
}

function renderProd() {
  const tb = document.getElementById("tabbody");
  const fornOpts = Object.entries(SUP).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  tb.innerHTML = `
    ${LIVE ? `<div class="callout">Mude o status direto na linha, ou marque vários itens e use a barra abaixo para mudar todos de uma vez. Cada mudança fica salva na hora.</div>` : roCallout()}
    <div class="tools">
      <input id="pq" type="search" placeholder="Buscar item, formando ou fornecedor" aria-label="Buscar item">
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
    ["bstgo", "bfogo", "bdtgo", "bclr"].forEach(id => { document.getElementById(id).disabled = sel.size === 0; });
    const all = document.getElementById("ckall");
    if (all) { const n = visiveis.filter(i => sel.has(i.id)).length; all.checked = n > 0 && n === visiveis.length; all.indeterminate = n > 0 && n < visiveis.length; }
  };
  const draw = () => {
    const base = atual === "geral" ? F : byEv(EVENTOS.find(x => x.slug === atual).id);
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
        if (!(i.produto.toLowerCase().includes(termo) || nome.toLowerCase().includes(termo) || (SUP[i.fornId] || "").toLowerCase().includes(termo))) return false;
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
      ["bstgo", "bfogo", "bdtgo", "bclr"].forEach(id => { document.getElementById(id).disabled = true; });
      res.className = "res"; res.textContent = `Salvando ${ids.length} itens…`;
      const r = await salvarLote(ids, campo, valor, (n, tot) => { res.textContent = `Salvando ${n} de ${tot}…`; });
      if (r.ok) { sel.clear(); res.className = "res ok"; res.textContent = `${r.n} ${r.n === 1 ? "item atualizado" : "itens atualizados"}: ${rotulo}.`; }
      else { res.className = "res err"; res.textContent = r.msg; }
      draw(); refreshResumo();
    };
    document.getElementById("bstgo").addEventListener("click", () => { const v = document.getElementById("bst").value; aplicar("status", v, STATUS_LABEL[v]); });
    document.getElementById("bfogo").addEventListener("click", () => { const v = document.getElementById("bfo").value; aplicar("forn", v, v ? SUP[v] : "sem fornecedor"); });
    document.getElementById("bdtgo").addEventListener("click", () => { const v = document.getElementById("bdt").value; aplicar("pedido", v, v ? `pedido enviado em ${fmtData(v)}` : "data do pedido apagada"); });
  }
  draw();
}

function wireList() {
  const q = document.getElementById("q"), sit = document.getElementById("sit"), list = document.getElementById("list");
  const draw = () => {
    const base = atual === "geral" ? F : byEv(EVENTOS.find(x => x.slug === atual).id);
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
    const s = ev.target.closest(".ed");
    if (!s) return;
    const tr = s.closest("tr");
    tr.dataset.lastCampo = s.dataset.campo;
    salvarItem(s.dataset.item, s.dataset.campo, s.value, tr);
  });
  draw();
}


/* ---------- Entrar, recuperar senha e abrir o painel ---------- */
const PAGINAS = ["geral", "resumo", "novo", "lucro"];
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
