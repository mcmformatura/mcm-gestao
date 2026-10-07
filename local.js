"use strict";
/* Modo local (só em localhost): imita o Supabase dentro do navegador para testar sem internet nem servidor.
   Dados: dados-locais.json (cópia do painel), guardados no localStorage deste navegador.
   Usuários de teste: usuarios-locais.json. Nenhum e-mail sai de verdade: a "caixa de entrada de teste" mostra o código.
   Para usar o Supabase de verdade em localhost, abra com ?supabase no endereço. Para voltar aos dados originais, ?reset. */
(function () {
  const ehLocal = ["localhost", "127.0.0.1"].includes(location.hostname) && !/[?&]supabase\b/.test(location.search);
  if (!ehLocal) return;

  const K_DB = "mcm-local-db-v1", K_USERS = "mcm-local-usuarios-v1", K_SESSAO = "mcm-local-sessao", K_CODIGOS = "mcm-local-codigos";
  const ler = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const apagar = k => { try { localStorage.removeItem(k); } catch (e) {} };
  const espera = () => new Promise(r => setTimeout(r, 120));
  const novoId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const copia = o => JSON.parse(JSON.stringify(o));

  if (/[?&]reset\b/.test(location.search)) { [K_DB, K_USERS, K_SESSAO, K_CODIGOS].forEach(apagar); }

  let DB = null, USERS = null;
  async function banco() {
    if (DB) return DB;
    DB = ler(K_DB);
    if (!DB) {
      const r = await fetch("dados-locais.json", { cache: "no-store" });
      if (!r.ok) throw new Error("não encontrei dados-locais.json");
      DB = await r.json();
      guardar(K_DB, DB);
    }
    return DB;
  }
  const salvar = () => guardar(K_DB, DB);
  async function usuarios() {
    if (USERS) return USERS;
    USERS = ler(K_USERS);
    if (!USERS) {
      const r = await fetch("usuarios-locais.json", { cache: "no-store" });
      if (!r.ok) throw new Error("não encontrei usuarios-locais.json");
      const j = await r.json();
      USERS = j.usuarios.map((u, i) => ({ id: "u_local_" + (i + 1), email: String(u.email).toLowerCase(), senha: u.senha, membro: u.membro !== false }));
      guardar(K_USERS, USERS);
    }
    return USERS;
  }
  const sessaoAtual = () => ler(K_SESSAO);
  const sessaoDe = u => ({ access_token: "local", token_type: "bearer", user: { id: u.id, email: u.email } });
  async function usuarioAtual() {
    const s = sessaoAtual();
    if (!s) return null;
    return (await usuarios()).find(u => u.id === s.user.id) || null;
  }

  /* ---------- Tabelas ---------- */
  function from(tabela) {
    let op = "select", payload = null, devolver = false, de = 0, ate = Infinity;
    const filtros = [], ordens = [];
    const q = {
      select() { if (op !== "select") devolver = true; return q; },
      order(c) { ordens.push(c); return q; },
      range(a, b) { de = a; ate = b; return q; },
      limit(n) { ate = de + n - 1; return q; },
      eq(c, v) { filtros.push([c, v]); return q; },
      update(o) { op = "update"; payload = o; return q; },
      upsert(o) { op = "upsert"; payload = o; return q; },
      then(ok, falha) { return executar().then(ok, falha); },
    };
    async function executar() {
      await espera();
      const u = await usuarioAtual();
      if (!u) return { data: null, error: { message: "not authenticated" } };
      if (tabela === "membros") return { data: u.membro ? [{ email: u.email }] : [], error: null };
      if (!u.membro) return { data: [], error: null };            // igual ao RLS: quem não é membro não vê nada
      const db = await banco();
      const linhas = db[tabela];
      if (!linhas) return { data: null, error: { message: `tabela ${tabela} não existe` } };
      const passa = r => filtros.every(([c, v]) => r[c] === v);
      if (op === "select") {
        let out = linhas.filter(passa);
        if (ordens.length) out = out.slice().sort((a, b) => {
          for (const c of ordens) {
            const x = a[c], y = b[c];
            if (x === y) continue;
            if (x == null) return 1;
            if (y == null) return -1;
            return x < y ? -1 : 1;
          }
          return 0;
        });
        return { data: copia(out.slice(de, ate === Infinity ? undefined : ate + 1)), error: null };
      }
      if (op === "update") {
        const alvo = linhas.filter(passa);
        alvo.forEach(r => Object.assign(r, copia(payload)));
        salvar();
        return { data: devolver ? alvo.map(r => ({ id: r.id })) : null, error: null };
      }
      if (op === "upsert") {
        const chave = tabela === "custos" ? "chave" : "id";
        const i = linhas.findIndex(r => r[chave] === payload[chave]);
        if (i >= 0) Object.assign(linhas[i], copia(payload)); else linhas.push(copia(payload));
        salvar();
        return { data: null, error: null };
      }
      return { data: null, error: { message: "operação não suportada no modo local" } };
    }
    return q;
  }

  /* ---------- Funções do banco (iguais às do Supabase) ---------- */
  async function rpc(nome, args) {
    await espera();
    const u = await usuarioAtual();
    if (!u || !u.membro) return { data: null, error: { message: "sem permissão" } };
    const db = await banco();
    if (nome === "criar_pedido") {
      const p = args.p || {};
      if (!(p.itens || []).length) return { data: null, error: { message: "pedido sem itens" } };
      let evId = p.evento && p.evento.id;
      if (!evId) {
        evId = novoId("ev_");
        db.eventos.push({ id: evId, nome: p.evento.nome, data: p.evento.data || null, slug: evId, ordem: 100, criado_por_pedido: true });
      }
      let foId = p.formando && p.formando.id, novo = false;
      if (!foId) { foId = novoId("fo_"); novo = true; db.formandos.push({ id: foId, evento_id: evId, nome: p.formando.nome }); }
      const pid = novoId("p");
      const base = Math.max(0, ...db.itens.filter(i => i.formando_id === foId).map(i => i.ordem || 0));
      let total = 0;
      p.itens.forEach((it, k) => {
        db.itens.push({ id: pid + "_" + (k + 1), formando_id: foId, pedido_id: pid, ordem: base + k + 1, produto: it.produto, fornecedor_id: it.fornId || null,
          qtd: it.qtd, valor_unit: it.vu, valor_total: it.vt, categoria: it.cat || "OUTROS", brinde: false, obs: it.obs || null, status: "AGUARDANDO_PRODUCAO", pedido_em: null });
        total += it.vt || 0;
      });
      db.pedidos.push({ id: pid, formando_id: foId, formando_novo: novo, total: Math.round(total * 100) / 100, criado_em: new Date().toISOString() });
      salvar();
      return { data: pid, error: null };
    }
    if (nome === "excluir_pedido") {
      const ped = db.pedidos.find(p => p.id === args.pid);
      if (!ped) return { data: null, error: { message: "pedido não encontrado" } };
      const fo = db.formandos.find(f => f.id === ped.formando_id);
      db.pedidos = db.pedidos.filter(p => p !== ped);
      db.itens = db.itens.filter(i => i.pedido_id !== ped.id);
      if (ped.formando_novo && fo && !db.itens.some(i => i.formando_id === fo.id) && !db.pagamentos.some(p => p.formando_id === fo.id)) {
        db.formandos = db.formandos.filter(f => f !== fo);
        const ev = db.eventos.find(e => e.id === fo.evento_id);
        if (ev && ev.criado_por_pedido && !db.formandos.some(f => f.evento_id === ev.id)) db.eventos = db.eventos.filter(e => e !== ev);
      }
      salvar();
      return { data: null, error: null };
    }
    return { data: null, error: { message: `função ${nome} não existe` } };
  }

  /* ---------- Login e recuperação de senha ---------- */
  const ouvintes = [];
  const avisarOuvintes = (ev, s) => ouvintes.forEach(f => { try { f(ev, s); } catch (e) {} });
  const auth = {
    async getSession() { return { data: { session: sessaoAtual() }, error: null }; },
    onAuthStateChange(f) { ouvintes.push(f); return { data: { subscription: { unsubscribe() {} } } }; },
    async signInWithPassword({ email, password }) {
      await espera();
      const u = (await usuarios()).find(x => x.email === String(email).toLowerCase());
      if (!u || u.senha !== password) return { data: { session: null }, error: { message: "Invalid login credentials", status: 400 } };
      const s = sessaoDe(u); guardar(K_SESSAO, s); avisarOuvintes("SIGNED_IN", s);
      return { data: { session: s, user: s.user }, error: null };
    },
    async signOut() { apagar(K_SESSAO); avisarOuvintes("SIGNED_OUT", null); return { error: null }; },
    async resetPasswordForEmail(email) {
      await espera();
      const u = (await usuarios()).find(x => x.email === String(email).toLowerCase());
      if (u) {
        const codigo = String(Math.floor(100000 + Math.random() * 900000));
        const cs = ler(K_CODIGOS) || {};
        cs[u.email] = { codigo, ate: Date.now() + 60 * 60 * 1000 };
        guardar(K_CODIGOS, cs);
        caixaDeEntrada(u, codigo);
      }
      return { data: {}, error: null };   // como o Supabase: não revela se o e-mail existe
    },
    async verifyOtp({ email, token }) {
      await espera();
      const em = String(email).toLowerCase(), cs = ler(K_CODIGOS) || {}, r = cs[em];
      if (!r || r.codigo !== String(token) || Date.now() > r.ate) return { data: {}, error: { message: "Token has expired or is invalid", status: 403 } };
      delete cs[em]; guardar(K_CODIGOS, cs);
      const u = (await usuarios()).find(x => x.email === em);
      const s = sessaoDe(u); guardar(K_SESSAO, s);
      return { data: { session: s, user: s.user }, error: null };
    },
    async updateUser({ password }) {
      await espera();
      const s = sessaoAtual();
      if (!s) return { data: {}, error: { message: "not authenticated" } };
      const us = await usuarios(), u = us.find(x => x.id === s.user.id);
      if (u.senha === password) return { data: {}, error: { message: "New password should be different from the old password." } };
      u.senha = password; guardar(K_USERS, us);
      return { data: { user: s.user }, error: null };
    },
  };

  /* ---------- Caixa de entrada de teste e aviso de modo local ---------- */
  const css = document.createElement("style");
  css.textContent = `
    .lc-tag { position: fixed; left: 12px; bottom: calc(env(safe-area-inset-bottom, 0px) + 12px); z-index: 50; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
      font: 600 0.72rem/1.2 var(--f-body, system-ui); letter-spacing: .06em; text-transform: uppercase; padding: 7px 10px; border-radius: 8px;
      background: var(--ink, #1d2230); color: var(--surface, #fff); box-shadow: 0 4px 14px rgba(0,0,0,.18); max-width: calc(100vw - 24px); }
    .lc-tag button { font: inherit; text-transform: none; letter-spacing: 0; font-weight: 500; background: none; border: 1px solid currentColor; color: inherit; border-radius: 6px; padding: 3px 8px; cursor: pointer; }
    .lc-mail { position: fixed; right: 12px; bottom: calc(env(safe-area-inset-bottom, 0px) + 12px); z-index: 60; width: min(360px, calc(100vw - 24px));
      background: var(--surface, #fff); color: var(--ink, #1d2230); border: 1px solid var(--line, #ddd); border-top: 4px solid var(--gold, #a87a1c);
      border-radius: 12px; box-shadow: 0 12px 34px rgba(0,0,0,.22); padding: 14px 16px; display: grid; gap: 8px; font: 0.88rem/1.45 var(--f-body, system-ui); }
    .lc-mail .lc-h { font-size: 0.7rem; letter-spacing: .1em; text-transform: uppercase; color: var(--muted, #666); font-weight: 600; }
    .lc-mail .lc-cod { font: 500 1.6rem/1 var(--f-data, monospace); letter-spacing: .3em; padding: 6px 0; user-select: all; }
    .lc-mail .lc-acoes { display: flex; gap: 8px; flex-wrap: wrap; }
    .lc-mail button { font: inherit; font-size: 0.84rem; padding: 6px 12px; border-radius: 7px; border: 1px solid var(--line, #ddd); background: var(--surface, #fff); color: var(--ink, #1d2230); cursor: pointer; }
    .lc-mail button.lc-p { background: var(--accent, #1f4e8c); border-color: var(--accent, #1f4e8c); color: var(--surface, #fff); font-weight: 600; }`;
  document.head.appendChild(css);

  function caixaDeEntrada(u, codigo) {
    document.querySelectorAll(".lc-mail").forEach(n => n.remove());
    const box = document.createElement("div");
    box.className = "lc-mail"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Caixa de entrada de teste");
    box.innerHTML = `<span class="lc-h">Caixa de entrada de teste · modo local</span>
      <div><b>Para:</b> <span class="lc-to"></span><br><b>Assunto:</b> Redefinir sua senha do MCM Gestão</div>
      <div>Use este código na tela "Criar nova senha", ou abra o link:</div>
      <div class="lc-cod"></div>
      <div class="lc-acoes"><button type="button" class="lc-p" data-a="link">Abrir link de recuperação</button><button type="button" data-a="fechar">Fechar</button></div>`;
    box.querySelector(".lc-to").textContent = u.email;
    box.querySelector(".lc-cod").textContent = codigo;
    box.addEventListener("click", e => {
      const a = e.target.closest("[data-a]");
      if (!a) return;
      if (a.dataset.a === "link") {
        const cs = ler(K_CODIGOS) || {}; delete cs[u.email]; guardar(K_CODIGOS, cs);
        const s = sessaoDe(u); guardar(K_SESSAO, s);
        avisarOuvintes("PASSWORD_RECOVERY", s);
      }
      box.remove();
    });
    document.body.appendChild(box);
  }

  function etiqueta() {
    const t = document.createElement("div");
    t.className = "lc-tag";
    t.innerHTML = `<span>Modo local · dados de teste neste navegador</span><button type="button">Restaurar dados originais</button>`;
    const b = t.querySelector("button");
    b.addEventListener("click", () => {
      if (b.dataset.ok !== "1") { b.dataset.ok = "1"; b.textContent = "Confirmar: apagar mudanças locais"; setTimeout(() => { b.dataset.ok = ""; b.textContent = "Restaurar dados originais"; }, 4000); return; }
      apagar(K_DB); location.reload();
    });
    document.body.appendChild(t);
  }
  if (document.body) etiqueta(); else document.addEventListener("DOMContentLoaded", etiqueta);

  window.MCM_LOCAL = { client: { from, rpc, auth } };
})();
