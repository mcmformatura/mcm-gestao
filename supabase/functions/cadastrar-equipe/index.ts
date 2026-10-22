// Cadastro da equipe sem e-mail de confirmação: confere o código da equipe e cria a conta já confirmada,
// já como membro do painel. Quem errar o código 10 vezes em uma hora (pelo mesmo endereço de internet) fica barrado.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });

async function sha256(t: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
// Procura a conta pelo e-mail (a equipe é pequena: poucas páginas)
async function contaPorEmail(email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find(x => (x.email || "").toLowerCase() === email);
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "use POST" }, 405);
  let corpo: any;
  try { corpo = await req.json(); } catch { return resposta({ erro: "Dados inválidos." }, 400); }
  const email = String(corpo?.email || "").trim().toLowerCase();
  const senha = String(corpo?.senha || "");
  const codigo = String(corpo?.codigo || "").trim().toUpperCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return resposta({ erro: "Digite um e-mail válido." }, 400);
  if (senha.length < 8 || senha.length > 72) return resposta({ erro: "A senha precisa ter pelo menos 8 caracteres." }, 400);
  if (codigo.length < 4 || codigo.length > 40) return resposta({ erro: "Digite o código da equipe." }, 400);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconhecido";
  const desde = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await sb.from("tentativas_cadastro").select("id", { count: "exact", head: true }).eq("ip", ip).gte("quando", desde);
  if ((count || 0) >= 10) return resposta({ erro: "Muitas tentativas com código errado. Espere uma hora e tente de novo." }, 429);

  const { data: cod } = await sb.from("codigo_equipe").select("codigo_hash").eq("id", 1).maybeSingle();
  if (!cod || cod.codigo_hash !== await sha256(codigo)) {
    await sb.from("tentativas_cadastro").insert({ ip });
    return resposta({ erro: "Código da equipe incorreto. Confira com a administração." }, 403);
  }

  try {
    const existente = await contaPorEmail(email);
    if (existente && existente.email_confirmed_at) {
      return resposta({ erro: "Esse e-mail já tem conta. Entre com a sua senha (ou use “Esqueci minha senha”).", jaTemConta: true }, 409);
    }
    if (existente) {
      // conta criada antes e nunca confirmada (ex.: cadastro antigo que pedia e-mail): confirma e define a senha
      const { error } = await sb.auth.admin.updateUserById(existente.id, { password: senha, email_confirm: true });
      if (error) throw error;
    } else {
      const { error } = await sb.auth.admin.createUser({ email, password: senha, email_confirm: true });
      if (error) throw error;
    }
    const { error: e2 } = await sb.from("membros").upsert({ email, papel: "membro" }, { onConflict: "email", ignoreDuplicates: true });
    if (e2) throw e2;
    return resposta({ ok: true });
  } catch (e) {
    const m = String((e as Error)?.message || e);
    if (/password/i.test(m)) return resposta({ erro: "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números." }, 400);
    return resposta({ erro: "Não deu para criar a conta agora. Tente de novo em instantes." }, 500);
  }
});
