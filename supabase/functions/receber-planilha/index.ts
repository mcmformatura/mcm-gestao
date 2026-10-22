// Recebe uma aba das planilhas do Google (enviada pelo Apps Script) e atualiza o cliente no sistema.
// A planilha manda em: itens, quantidades, valores, pagamentos e descontos.
// O site manda em: status, fornecedor, data e nº do pedido, prazo, barras e cores (nada disso é tocado aqui).
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

type Linha = string[];
type Item = { produto: string; qtd: number; vu: number | null; vt: number | null; brinde: boolean; obs: string; cat: string };
type Pag = { tipo: string; descricao: string; valor: number; data: string | null; status: string; obs: string };

async function sha256(t: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const semAcento = (s: string) => String(s).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();
const rnd = (n = 10) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const hojeISO = () => new Date().toISOString().slice(0, 10);

// ---------- Leitura da aba (mesmas regras da importação) ----------
function toNum(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/R\$/g, "").replace(/\s/g, "").replace(/,,/g, ",");
  if (!s) return null;
  if (/^-?\d+(\.\d+)?$/.test(s) && !/^\d{1,3}\.\d{3}$/.test(s)) return parseFloat(s);
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return parseFloat(s.replace(/\./g, "").replace(",", "."));
  if (/^-?\d+,\d+$/.test(s)) return parseFloat(s.replace(",", "."));
  return null;
}
// Data "dd.mm" sem ano: o ano é o que mantém os pagamentos em ordem (o primeiro fica no passado mais próximo)
function lerData(txt: string, anterior: string | null): string | null {
  const m = /(\d{1,2})\s*[./]\s*(\d{1,2})(?:\s*[./]\s*(\d{2,4}))?/.exec(txt);
  if (!m) return null;
  const d = +m[1], mo = +m[2];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (m[3]) { let y = +m[3]; if (y < 100) y += 2000; return iso(y, mo, d); }
  const hoje = new Date();
  if (anterior) {
    const ya = +anterior.slice(0, 4);
    for (const y of [ya, ya + 1]) { const c = iso(y, mo, d); if (c >= isoMenosDias(anterior, 15)) return c; }
    return iso(ya + 1, mo, d);
  }
  const limite = isoMaisDias(hoje.toISOString().slice(0, 10), 15);
  for (const y of [hoje.getFullYear() + 1, hoje.getFullYear(), hoje.getFullYear() - 1]) { const c = iso(y, mo, d); if (c <= limite) return c; }
  return iso(hoje.getFullYear() - 1, mo, d);
}
function isoMaisDias(s: string, n: number) { const t = new Date(s + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
const isoMenosDias = (s: string, n: number) => isoMaisDias(s, -n);

function adivinhar(produto: string) {
  const p = produto.toLowerCase();
  if (/montagem|pacote|carrinho|abaj|flor|tubo|desmontagem|demsontagem|porta (piru|canudo|botton)|deslocamento|multa|m[oó]dulo/.test(p)) return "MONTAGEM";
  if (/doce|bombom|topiaria|bem casado|bolo|chocolate|macaron|fatia/.test(p)) return "DOCES";
  if (/ta[cç]a|copo|champanh|balde|shot|whisky|bohemia|beth|banheira/.test(p)) return "COPOS";
  if (/taxa|identidade|id visual|vetoriz|souplast|menu|guardanapo|sacola|lacre|tag|botton|marcador|caixa|avental|passadeira|hot/.test(p)) return "PAPELARIA";
  return "LEMBRANCAS";
}
const SECOES: [RegExp, string][] = [[/PAPELARIA/, "PAPELARIA"], [/LEMBRAN/, "LEMBRANCAS"], [/COPO/, "COPOS"], [/DOCE/, "DOCES"], [/MONTAGEM/, "MONTAGEM"]];

// Divide a aba em orçamentos: cada linha com "QNTD" na coluna B começa um
function blocos(linhas: Linha[]) {
  const out: { n: number; h: Record<string, string> }[][] = [];
  let atual: { n: number; h: Record<string, string> }[] | null = null;
  linhas.forEach((l, i) => {
    const h: Record<string, string> = {};
    "ABCDEFGH".split("").forEach((c, k) => { const v = String(l[k] ?? "").replace(/\s+/g, " ").trim(); if (v) h[c] = v; });
    if (!Object.keys(h).length) return;
    if ((h.B || "").toUpperCase() === "QNTD") { atual = []; out.push(atual); return; }
    if (atual) atual.push({ n: i + 1, h });
  });
  return out;
}

function lerBloco(rows: { n: number; h: Record<string, string> }[]) {
  const itens: Item[] = [], pags: Pag[] = [], avisos: string[] = [];
  let pend: Item[] = [], depoisTotal = false, totalPlan: number | null = null, ultimaData: string | null = null;
  for (const { n, h } of rows) {
    const a = h.A; if (!a) continue;
    const up = a.toUpperCase();
    const secao = SECOES.find(([re]) => re.test(up));
    if (/^\s*(SUBTOTAL|SUB TOTAL|SUBSTOTAL|SUTOTAL)/.test(up) || (/^\s*TOTAL/.test(up) && secao && !/GERAL/.test(up))) {
      const sec = secao ? secao[1] : null;
      pend.forEach(it => { const g = adivinhar(it.produto); it.cat = !sec ? g : (sec === "COPOS" && g === "PAPELARIA") ? g : sec; });
      pend = []; continue;
    }
    if (/RESTANTE|^\s*RESTA/.test(up)) continue;
    if (/^\s*(TOTAL|GERAL)\b/.test(up)) {                        // "TOTAL GERAL", "TOTAL" ou só "GERAL"
      const v = toNum(h.D);
      if (/DESC|AP[OÓ]S|%/.test(up)) {
        if (totalPlan && v && v < totalPlan) pags.push({ tipo: "DESCONTO", descricao: a, valor: Math.round((totalPlan - v) * 100) / 100, data: null, status: "PAGO", obs: "" });
        continue;
      }
      if (!totalPlan) totalPlan = v;
      pend.forEach(it => { it.cat = adivinhar(it.produto); }); pend = []; depoisTotal = true; continue;
    }
    if (/^\s*DESC/.test(up)) { const dv = toNum(h.D); if (dv) pags.push({ tipo: "DESCONTO", descricao: a, valor: dv, data: null, status: "PAGO", obs: "" }); continue; }
    if (/^\s*(PAGO|PG |A PAGAR|PAGAR)/.test(up)) {
      const val = toNum(h.D);
      if (val && val > 0) {
        let st = /^\s*(A PAGAR|PAGAR)/.test(up) ? "A_PAGAR" : "PAGO";
        const dt = lerData(a, ultimaData);
        if (dt) ultimaData = dt;
        if (st === "PAGO" && dt && dt > hojeISO()) { st = "A_PAGAR"; avisos.push(`linha ${n}: '${a}' tem data futura: entrou como a pagar`); }
        const obs = h.E && toNum(h.E) == null ? h.E : "";
        pags.push({ tipo: "PARCELA", descricao: a, valor: val, data: dt, status: st, obs });
      }
      continue;
    }
    if (depoisTotal) continue;
    let q = toNum(h.B), un = toNum(h.C);
    const t = toNum(h.D), dRaw = h.D || "";
    if (q == null && un == null && t == null) { avisos.push(`linha ${n}: '${a}' sem quantidade/valor`); continue; }
    if (q != null && un != null && q !== Math.floor(q) && un === Math.floor(un)) { const x = q; q = un; un = x; avisos.push(`linha ${n}: '${a}' qtd e valor unitário trocados (corrigido)`); }
    const brinde = /BRINDE/i.test(dRaw);
    if (q == null && t === 0 && !brinde) { avisos.push(`linha ${n}: '${a}' sem quantidade e total 0: não importado`); continue; }
    const notas = [h.E && toNum(h.E) == null ? h.E : "", brinde ? "BRINDE" : ""].filter(Boolean);
    if (q == null) q = t === 0 && !brinde ? 0 : 1;
    const it: Item = { produto: a, qtd: Math.round(q), vu: un, vt: brinde ? 0 : t, brinde, obs: notas.join(" / "), cat: "OUTROS" };
    itens.push(it); pend.push(it);
  }
  pend.forEach(it => { it.cat = adivinhar(it.produto); });
  return { itens, pags, totalPlan, avisos };
}

// Fornecedor só para itens novos, quando o produto tem um único fornecedor no catálogo
function fornecedor(produto: string, cat: string): string | null {
  if (!["PAPELARIA", "LEMBRANCAS", "COPOS"].includes(cat)) return null;
  const p = produto.toLowerCase();
  if (/tags?\b.*acr[ií]lico|tags? (de |para |p\/)?acr/.test(p)) return "VM";
  if (/identidade visual|id visual|^id\b|taxa.*(id|papelaria|arte|vetor)|vetoriza|guardanapo|n?e?cessaire|mini hel|bolsa(?!inha)|gloss|lip ?b|cartonad|gin ?box|menu acr/.test(p)) return null;
  if (/avental/.test(p)) return /premium|bordado/.test(p) ? "Felipe" : null;
  if (/tags?.*nome|tag convidado/.test(p)) return "Produção Própria MCM";
  if (/tags?.*(papel|bolsa)/.test(p)) return null;
  if (/lacre|^tags?\b/.test(p)) return "Casa da Cópia";
  if (/havaian/.test(p)) return "Produção Própria MCM";
  if (/souplast|\bmenu\b|bottons?|marcador|adesivos kit/.test(p)) return "Casa da Cópia";
  if (/sacola|hot ?stamping|gorgur|gurgur/.test(p)) return "Império";
  if (/chinel|rasteir|sand[aá]lia/.test(p)) return "Pé&Pé";
  if (/bon[eé]|dad hat/.test(p)) return "Shop Boné";
  if (/ta[cç]a|copo|champanheira|champeira|balde|banheira|caixa.*acr|caixinha|cx.*acr|ecobag|b[oó]hemia|beth|shot|whisky|dtf|adesivo|[oó]culos/.test(p)) return "Produção Própria MCM";
  return null;
}

// ---------- Cliente e turma para abas novas ----------
function nomeDaAba(t: string) {
  const n = t.replace(/\(\s*or[cç]amento\s*\)/gi, " ")
    .replace(/\b\d{1,2}\s*[./]\s*\d{1,2}(\s*[./]\s*\d{2,4})?(?!\d)/g, " ")
    .replace(/\b(ENVIO|ENVIAR|RETIRADA|RET|OK|MONT\.?|MONTAGEM|ENTREGA DE ITENS|C\/C|CC)\b/gi, " ")
    .replace(/\(\s*\)/g, " ").replace(/[-–]+/g, " ").replace(/\s+/g, " ").trim();
  return n || t.trim();
}
async function turmaParaAbaNova(planilhaId: string, titulo: string): Promise<string> {
  const m = /(\d{1,2})\s*[./]\s*(\d{1,2})/.exec(titulo);
  if (m && +m[2] >= 1 && +m[2] <= 12) {
    const dia = +m[1], mes = +m[2];
    const { data: evs } = await sb.from("eventos").select("id,data").not("data", "is", null);
    const mesmos = (evs || []).filter(e => +e.data.slice(5, 7) === mes && +e.data.slice(8, 10) === dia);
    if (mesmos.length === 1) return mesmos[0].id;
  }
  // data no nome da aba e nenhuma turma nesse dia: cria "Entregas DD/MM"; sem data: turma padrão da planilha
  if (m && +m[2] >= 1 && +m[2] <= 12) {
    const dia = +m[1], mes = +m[2], hoje = new Date();
    // ano em que a data fica mais perto de hoje
    const anos = [hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1];
    const y = anos.reduce((b, c) => Math.abs(+new Date(c, mes - 1, dia) - +hoje) < Math.abs(+new Date(b, mes - 1, dia) - +hoje) ? c : b, anos[1]);
    const data = iso(y, mes, dia), id = `ev_pl_${data.replace(/-/g, "")}`;
    const { data: existe } = await sb.from("eventos").select("id").eq("id", id).maybeSingle();
    if (existe) return id;
    const dd = `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
    await sb.from("eventos").insert({ id, nome: `Entregas ${dd}`, data, slug: `entregas-${dd.replace("/", "")}-${String(y).slice(2)}`, ordem: 100 });
    return id;
  }
  const { data: pl } = await sb.from("planilhas").select("evento_padrao_id").eq("id", planilhaId).maybeSingle();
  if (pl?.evento_padrao_id) return pl.evento_padrao_id;
  const id = "ev_planilhas";
  const { data: existe } = await sb.from("eventos").select("id").eq("id", id).maybeSingle();
  if (!existe) await sb.from("eventos").insert({ id, nome: "Novos das planilhas (sem data)", data: null, slug: "novos-das-planilhas", ordem: 999 });
  return id;
}

// ---------- Comparação com o que já está no sistema ----------
const mesmoNum = (a: unknown, b: unknown) => (a == null && b == null) || (a != null && b != null && Math.abs(+a - +b) < 0.006);   // o banco guarda 2 casas (598,185 vira 598,19), mas 1 centavo de diferença ainda conta
async function sincronizarCliente(fo: string, itens: Item[], pags: Pag[], simular = false) {
  const { data: atuais, error } = await sb.from("itens").select("id,ordem,produto,qtd,valor_unit,valor_total,categoria,brinde,obs").eq("formando_id", fo).is("pedido_id", null).order("ordem");
  if (error) throw error;
  const livres = new Set((atuais || []).map(e => e.id));
  const par: any[] = [];
  // 1º: mesmo nome de produto
  itens.forEach((it, i) => { const e = (atuais || []).find(x => livres.has(x.id) && semAcento(x.produto) === semAcento(it.produto)); if (e) { par[i] = e; livres.delete(e.id); } });
  // 2º: mesmo lugar e mesmo setor (produto renomeado na planilha)
  itens.forEach((it, i) => { if (par[i]) return; const e = (atuais || []).find(x => livres.has(x.id) && x.ordem === i + 1 && x.categoria === it.cat); if (e) { par[i] = e; livres.delete(e.id); } });
  const atualizar: unknown[] = [], inserir: unknown[] = [];
  itens.forEach((it, i) => {
    const novo = { ordem: i + 1, produto: it.produto, qtd: it.qtd, valor_unit: it.vu, valor_total: it.vt, categoria: it.cat, brinde: it.brinde, obs: it.obs };
    const e = par[i];
    if (!e) { inserir.push({ id: `ipl_${rnd()}`, ...novo, fornecedor: fornecedor(it.produto, it.cat) }); return; }
    novo.categoria = e.categoria; novo.obs = e.obs || "";      // setor e observação de item que já existe ficam como estão no sistema
    const mudou = e.ordem !== novo.ordem || e.produto !== novo.produto || !mesmoNum(e.qtd, novo.qtd) || !mesmoNum(e.valor_unit, novo.valor_unit)
      || !mesmoNum(e.valor_total, novo.valor_total) || e.categoria !== novo.categoria || !!e.brinde !== novo.brinde || (e.obs || "") !== (novo.obs || "");
    if (mudou) atualizar.push({ id: e.id, ...novo });
  });
  const remover = [...livres];

  // Pagamentos da planilha: só regrava se mudou algo
  const novosPag = pags.map((p, k) => ({ ordem: k + 1, tipo: p.tipo, descricao: p.descricao, valor: p.valor,
    data: p.data ? `${p.data.slice(8, 10)}/${p.data.slice(5, 7)}/${p.data.slice(0, 4)}` : "", status: p.status, obs: p.obs }));
  const { data: pagAtuais } = await sb.from("pagamentos").select("ordem,tipo,descricao,valor,data,status,obs").eq("formando_id", fo).eq("origem", "planilha").order("ordem");
  const chave = (l: any[]) => JSON.stringify(l.map(p => [p.tipo, p.descricao, Math.round(+p.valor * 100), p.data || "", p.status, p.obs || ""]));
  const plano: Record<string, unknown> = { atualizar, inserir, remover };
  if (chave(pagAtuais || []) !== chave(novosPag)) plano.pagamentos = novosPag;
  if (simular) return { simulacao: true, alterados: atualizar.length, novos: inserir.length, removidos: remover.length, pagamentos: plano.pagamentos ? novosPag.length : 0, plano, antes: { itens: atuais, pagamentos: pagAtuais } };
  if (!atualizar.length && !inserir.length && !remover.length && !plano.pagamentos) return { alterados: 0, novos: 0, removidos: 0, pagamentos: 0, semMudanca: true };
  const { data, error: e2 } = await sb.rpc("aplicar_sync_planilha", { p_formando: fo, p: plano });
  if (e2) throw e2;
  return data;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "use POST" }, 405);
  let corpo: any;
  try { corpo = await req.json(); } catch { return resposta({ erro: "corpo inválido" }, 400); }
  const { token, planilha_id, planilha_titulo, aba } = corpo || {};
  const simular = corpo?.simular === true;
  if (!token || typeof token !== "string") return resposta({ erro: "senha da integração ausente" }, 401);
  const { data: ok } = await sb.from("integracao_tokens").select("token_hash").eq("token_hash", await sha256(token)).maybeSingle();
  if (!ok) return resposta({ erro: "senha da integração inválida" }, 401);
  if (corpo.acao === "lista") {                              // planilhas que o script do Google deve acompanhar
    const { data } = await sb.from("planilhas").select("id,titulo,atualizado_em,ativa").order("atualizado_em", { ascending: false });
    return resposta({ ok: true, planilhas: data || [] });
  }
  if (!planilha_id || !aba || typeof aba.gid !== "number" || !Array.isArray(aba.linhas)) return resposta({ erro: "dados da aba incompletos" }, 400);
  if (aba.linhas.length > 2000) return resposta({ erro: "aba grande demais" }, 400);

  const titulo = String(aba.titulo || "").replace(/\s+/g, " ").trim();
  const { data: pl0 } = await sb.from("planilhas").select("ativa").eq("id", planilha_id).maybeSingle();
  if (pl0 && pl0.ativa === false) return resposta({ ok: true, ignorada: true, aba: titulo });   // planilha antiga, fora do site
  if (!simular) await sb.from("planilhas").upsert({ id: planilha_id, titulo: planilha_titulo || null, atualizado_em: new Date().toISOString() }, { onConflict: "id", ignoreDuplicates: false });
  const { data: mapa } = await sb.from("planilha_abas").select("bloco,formando_id,ignorar").eq("planilha_id", planilha_id).eq("aba_gid", aba.gid).order("bloco");
  if ((mapa || []).some(m => m.bloco === 0 && m.ignorar)) return resposta({ ok: true, ignorada: true, aba: titulo });

  const bs = blocos(aba.linhas);
  if (!bs.length) return resposta({ ok: false, aba: titulo, erro: "aba sem orçamento (falta a linha com QNTD na coluna B); nada foi alterado" });

  const resultados: unknown[] = [];
  for (let b = 0; b < bs.length; b++) {
    let m = (mapa || []).find(x => x.bloco === b);
    if (b > 0 && !m) break;                                   // orçamentos extras só quando estão ligados a um cliente
    if (m?.ignorar) continue;
    const lido = lerBloco(bs[b]);
    let fo = m?.formando_id || null, novoCliente = false;
    try {
      if (!fo) {
        if (!lido.itens.length) { resultados.push({ bloco: b, erro: "orçamento sem itens; nada foi criado" }); continue; }
        if (simular) { resultados.push({ bloco: b, simulacao: true, novoCliente: true, nome: nomeDaAba(titulo), itens: lido.itens, pagamentos: lido.pags, avisos: lido.avisos }); continue; }
        const ev = await turmaParaAbaNova(planilha_id, titulo);
        fo = `fpl_${rnd()}`;
        const { error } = await sb.from("formandos").insert({ id: fo, evento_id: ev, nome: nomeDaAba(titulo) });
        if (error) throw error;
        await sb.from("planilha_abas").upsert({ planilha_id, aba_gid: aba.gid, bloco: b, aba_titulo: titulo, formando_id: fo, ignorar: false });
        novoCliente = true;
      } else if (!simular) {
        await sb.from("planilha_abas").update({ aba_titulo: titulo, atualizado_em: new Date().toISOString() }).eq("planilha_id", planilha_id).eq("aba_gid", aba.gid).eq("bloco", b);
      }
      if (!lido.itens.length) {
        resultados.push({ bloco: b, formando_id: fo, erro: "a aba ficou sem itens; por segurança nada foi apagado" });
        continue;
      }
      const r = await sincronizarCliente(fo, lido.itens, lido.pags, simular);
      const soma = Math.round(lido.itens.reduce((a, i) => a + (i.vt || 0), 0) * 100) / 100;
      const res = { bloco: b, formando_id: fo, novoCliente, ...r, itens: lido.itens.length, total: soma, totalPlanilha: lido.totalPlan, avisos: lido.avisos };
      resultados.push(res);
      if (!simular) await sb.from("planilha_sync_log").insert({ planilha_id, aba_titulo: titulo, formando_id: fo, resultado: res });
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      resultados.push({ bloco: b, formando_id: fo, erro: msg });
      await sb.from("planilha_sync_log").insert({ planilha_id, aba_titulo: titulo, formando_id: fo, erro: msg });
    }
  }
  return resposta({ ok: true, aba: titulo, resultados });
});
