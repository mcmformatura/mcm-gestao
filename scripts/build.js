// Build da Vercel: copia o site para dist/ e gera dist/config.js com as variáveis de ambiente.
// Localmente também lê o arquivo .env, se existir.
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..");
const dist = path.join(raiz, "dist");

const envArq = path.join(raiz, ".env");
if (fs.existsSync(envArq)) {
  for (const linha of fs.readFileSync(envArq, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Faltam as variáveis SUPABASE_URL e/ou SUPABASE_PUBLISHABLE_KEY.");
  process.exit(1);
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  console.error("SUPABASE_URL deve ser algo como https://xxxx.supabase.co");
  process.exit(1);
}
// Nunca publicar a chave secreta: ela iria parar no navegador de qualquer visitante
let papel = "";
if (key.startsWith("eyJ")) {
  try { papel = JSON.parse(Buffer.from(key.split(".")[1], "base64").toString()).role; } catch (e) { papel = "?"; }
}
if (key.startsWith("sb_secret_") || (key.startsWith("eyJ") && papel !== "anon")) {
  console.error("SUPABASE_PUBLISHABLE_KEY é uma chave SECRETA. Use a chave pública (sb_publishable_... ou anon).");
  process.exit(1);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);
for (const arq of ["index.html", "app.js"]) fs.copyFileSync(path.join(raiz, arq), path.join(dist, arq));
const config = { supabaseUrl: url.replace(/\/$/, ""), supabaseKey: key };
fs.writeFileSync(path.join(dist, "config.js"), `window.MCM_CONFIG = ${JSON.stringify(config)};\n`);
console.log(`dist/ pronto para ${config.supabaseUrl}`);
