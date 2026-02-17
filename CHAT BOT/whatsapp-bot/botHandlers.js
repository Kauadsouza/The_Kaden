// whatsapp-bot/botHandlers.js
// ✅ COPIA E COLA INTEIRO
// ✅ O que foi adicionado:
// 1) MEMÓRIA LEVE POR CONTATO (persistente em arquivo sessions.json)
//    - guarda step, dados, último produto escolhido, greeted, lastSeen
//    - expira sessões antigas (7 dias) automaticamente
// 2) SIMULAÇÃO COM “TIPO DE RENDA” SEPARADO (CLT/PJ)
//    - pergunta askType
//    - se CLT -> pergunta ask3Years
//    - se PJ  -> pergunta askPJTime (novo, com fallback)
//    - donePF já inclui {tipo} e {clt3anos} (e {pjTempo} se quiser usar no template)
//
// ✅ IMPORTANTE:
// - Crie (ou deixe o código criar) o arquivo: /sessions.json na raiz do projeto (mesmo nível de config.json)

const fs = require("fs");
const path = require("path");
const { MessageMedia } = require("whatsapp-web.js");

require("dotenv").config();

const CONFIG_PATH   = path.resolve(__dirname, "../config.json");
const LOCKS_PATH    = path.resolve(__dirname, "../locks.json");
const SESSIONS_PATH = path.resolve(__dirname, "../sessions.json");

// pasta base do bot (onde fica /media)
const BOT_DIR = __dirname; // .../whatsapp-bot

let hooks = false;
function installHooksOnce() {
  if (hooks) return;
  hooks = true;
  process.on("unhandledRejection", (r) => console.log("⚠️ unhandledRejection:", r));
  process.on("uncaughtException", (e) => console.log("⚠️ uncaughtException:", e));
}

function safeReadJson(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

function safeWriteJson(p, data) {
  try {
    fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.log("⚠️ Erro salvando JSON:", p, e?.message || e);
  }
}

function tpl(str, vars) {
  let out = String(str || "");
  for (const [k, v] of Object.entries(vars || {})) out = out.replaceAll(`{${k}}`, v ?? "");
  return out;
}

// ======= NLP simples (sim/não mais humano) =======
function normalizeText(input){
  return String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseYesNoWithCfg(text, cfg){
  const t = normalizeText(text);

  const yesList = Array.isArray(cfg?.nlp?.yes) ? cfg.nlp.yes : [];
  const noList  = Array.isArray(cfg?.nlp?.no)  ? cfg.nlp.no  : [];

  const matches = (arr) => {
    for (const raw of arr) {
      const k = normalizeText(raw);
      if (!k) continue;
      if (t === k) return true;
      if (t.includes(k)) return true;
    }
    return false;
  };

  if (matches(yesList)) return true;
  if (matches(noList)) return false;

  if (["sim", "s", "claro", "ok", "pode", "quero", "manda", "enviar", "yes"].includes(t)) return true;
  if (["nao", "não", "n", "negativo", "no"].includes(t)) return false;

  return null;
}

// ======= Tipo de renda (CLT/PJ) =======
function parseIncomeType(text){
  const t = normalizeText(text);

  // aceita várias formas
  if (t.includes("clt") || t.includes("carteira") || t.includes("registrad")) return "CLT";
  if (t.includes("pj") || t.includes("cnpj") || t.includes("empresa") || t.includes("autonom") || t.includes("autônom")) return "PJ";

  // também aceita "1" e "2" se você quiser orientar assim
  if (t === "1") return "CLT";
  if (t === "2") return "PJ";

  return null;
}

function normalizeCPF(input) {
  return String(input || "").replace(/\D/g, "");
}
function isValidCPFFormat(cpfDigits) {
  return cpfDigits && cpfDigits.length === 11;
}
function maskCPF(cpfDigits) {
  if (!cpfDigits || cpfDigits.length !== 11) return cpfDigits || "";
  return `${cpfDigits.slice(0, 3)}.***.***-${cpfDigits.slice(9, 11)}`;
}
function normalizeDateBR(input) {
  const t = String(input || "").trim();
  const m = t.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (yyyy < 1900 || yyyy > 2100) return null;
  if (mm < 1 || mm > 12) return null;
  const maxDay = new Date(yyyy, mm, 0).getDate();
  if (dd < 1 || dd > maxDay) return null;
  return `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${yyyy}`;
}

// ================== CONFIG "FRESH" (recarrega quando muda) ==================
let _cfgCache = null;
let _cfgMtime = 0;

function readConfigFresh() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return _cfgCache || {};
    const st = fs.statSync(CONFIG_PATH);
    if (!_cfgCache || st.mtimeMs !== _cfgMtime) {
      _cfgCache = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      _cfgMtime = st.mtimeMs;
      console.log("✅ Config recarregada do painel.");
    }
    return _cfgCache || {};
  } catch (e) {
    console.log("⚠️ Erro lendo config:", e?.message || e);
    return _cfgCache || {};
  }
}

function ensureTexts(cfg){
  if(!cfg.texts || typeof cfg.texts !== "object") cfg.texts = {};
  const t = cfg.texts;

  if(typeof t.miniMenu !== "string") t.miniMenu =
    "O que você quer fazer agora?\n\n1) Ver outro empreendimento\n2) Fazer uma simulação\n3) Falar com um corretor\n\nResponda com 1, 2, 3 ou \"menu\".";

  if(typeof t.miniMenuSingle !== "string") t.miniMenuSingle =
    "O que você quer fazer agora?\n\n1) Fazer uma simulação\n2) Falar com um corretor\n\nResponda com 1, 2 ou \"menu\".";

  if(typeof t.fallbackMenu !== "string") t.fallbackMenu =
    "Para continuar, digite 1, 2 ou 3 (ou \"menu\").";

  if(typeof t.askMediaAgain !== "string") t.askMediaAgain =
    "Você quer que eu te envie as fotos e vídeos desse empreendimento? (pode responder do seu jeito 🙂)";

  if(typeof t.noMediaOk !== "string") t.noMediaOk = "Sem problema 😊";

  if(typeof t.sendingMedia !== "string") t.sendingMedia =
    "Perfeito! Vou te enviar *fotos e vídeos* agora ✅";

  if(typeof t.noMediaAvailable !== "string") t.noMediaAvailable =
    "⚠️ Ainda não temos fotos ou vídeos cadastrados para este empreendimento.";

  if(typeof t.chooseProductNumber !== "string") t.chooseProductNumber =
    "Me diga o número do empreendimento.\nEx: *1* ou *quero a casa 1*";

  if(typeof t.invalidProductNumber !== "string") t.invalidProductNumber =
    "Número inválido. Escolha entre 1 e {limit}.";

  if(typeof t.productChosen !== "string") t.productChosen =
    "✅ Você escolheu: *{nome}*";

  if(typeof t.restartMsg !== "string") t.restartMsg =
    "Certo! Vamos recomeçar 😊";

  return cfg;
}

function ensureHumanize(cfg){
  if(!cfg.humanize || typeof cfg.humanize !== "object") cfg.humanize = {};
  const h = cfg.humanize;

  if(typeof h.enabled !== "boolean") h.enabled = true;
  if(typeof h.minDelayMs !== "number") h.minDelayMs = 1200;
  if(typeof h.maxDelayMs !== "number") h.maxDelayMs = 5000;
  if(typeof h.typing !== "boolean") h.typing = true;

  if(!Array.isArray(h.ackPhrases)) h.ackPhrases = ["Show!", "Perfeito!", "Boa 😄", "Entendi!", "Beleza!"];
  return cfg;
}

function ensureSimulation(cfg){
  if(!cfg.simulation || typeof cfg.simulation !== "object") cfg.simulation = {};
  const s = cfg.simulation;

  if(typeof s.askName !== "string") s.askName = "Qual seu nome completo?";
  if(typeof s.askCPF !== "string") s.askCPF = "Qual seu CPF?";
  if(typeof s.askBirth !== "string") s.askBirth = "Qual sua data de nascimento? (DD/MM/AAAA)";

  // ✅ tipo de renda + ramificações
  if(typeof s.askType !== "string") s.askType = "Sua renda é CLT ou PJ?";
  if(typeof s.ask3Years !== "string") s.ask3Years = "Você tem mais de 3 anos de carteira assinada? (sim/não)";
  if(typeof s.askPJTime !== "string") s.askPJTime = "Há quanto tempo você trabalha como PJ (ou tem CNPJ)? (ex: 2 anos)";

  if(typeof s.askFirstHome !== "string") s.askFirstHome = "Esse será seu primeiro imóvel? (sim/não)";
  if(typeof s.askHasDebts !== "string") s.askHasDebts = "Você possui alguma pendência no nome? (sim/não)";
  if(typeof s.askDependents !== "string") s.askDependents = "Você possui dependentes? (sim/não)";
  if(typeof s.askDependentsCount !== "string") s.askDependentsCount = "Quantos dependentes você tem?";
  if(typeof s.askVisit !== "string") s.askVisit = "Podemos agendar a visita na casa modelo? (sim/não)";

  if(typeof s.donePF !== "string"){
    s.donePF =
`Perfeito! Anotei tudo aqui 👇

• Nome: {nome}
• CPF: {cpfMask}
• Nascimento: {nascimento}
• Tipo de renda: {tipo}
• 3+ anos CLT: {clt3anos}
• Tempo PJ: {pjTempo}
• Primeiro imóvel: {primeiroImovel}
• Pendências no nome: {pendencias}
• Dependentes: {dependentes}`;
  }

  return cfg;
}

function getProducts(cfg){
  if (cfg && Array.isArray(cfg.products) && cfg.products.length) return cfg.products;
  if (cfg && cfg.product && typeof cfg.product === "object") return [cfg.product];
  return [];
}
function hasMultipleProducts(cfg){
  return getProducts(cfg).length > 1;
}

function productsListMessage(cfg){
  const list = getProducts(cfg);
  if(!list.length) return "⚠️ Nenhum produto cadastrado no painel.";

  const limit = Math.min(list.length, 20);
  let msg = "*Escolha um empreendimento/produto:*\n\n";
  for (let i = 0; i < limit; i++) {
    const p = list[i];
    const nome = (p?.nome || `Produto ${i+1}`).trim();
    msg += `${i+1}) ${nome}\n`;
  }

  if (list.length > 20) {
    msg += `\n⚠️ Você tem ${list.length} produtos no painel. Por enquanto o bot mostra e aceita escolha de 1 a 20.\n`;
  }

  msg += `\nResponda com o número.\nExemplos: *1*  |  *quero a casa 1*  |  *opção 2*`;
  return msg;
}

function extractChoiceNumber(text){
  const m = String(text || "").match(/\b(\d{1,2})\b/);
  if(!m) return null;
  const n = Number(m[1]);
  if(!Number.isFinite(n)) return null;
  return n;
}

// ================== MEMÓRIA LEVE (persistência) ==================
// expira em 7 dias
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function loadSessions(){
  const obj = safeReadJson(SESSIONS_PATH, {});
  if(!obj || typeof obj !== "object") return {};
  return obj;
}

function saveSessions(all){
  safeWriteJson(SESSIONS_PATH, all || {});
}

function cleanupSessions(all){
  const now = Date.now();
  let changed = false;
  for(const [from, s] of Object.entries(all || {})){
    const last = Number(s?.lastSeen || 0);
    if(!last || now - last > SESSION_TTL_MS){
      delete all[from];
      changed = true;
    }
  }
  if(changed) saveSessions(all);
}

function getDefaultSession(){
  return {
    step: "MENU",
    greeted: false,
    data: {},
    productIndex: 0,
    lastSeen: Date.now()
  };
}

function getSession(from, allSessions) {
  if(!allSessions[from]) {
    allSessions[from] = getDefaultSession();
    saveSessions(allSessions);
  }
  return allSessions[from];
}

function resetSession(from, allSessions) {
  allSessions[from] = getDefaultSession();
  saveSessions(allSessions);
}

function touchSession(from, allSessions){
  if(!allSessions[from]) return;
  allSessions[from].lastSeen = Date.now();
  saveSessions(allSessions);
}

function getSelectedProduct(cfg, from, allSessions){
  const list = getProducts(cfg);
  if(!list.length) return null;

  const s = getSession(from, allSessions);
  const idx = Math.max(0, Math.min(s.productIndex || 0, list.length - 1));
  s.productIndex = idx;
  return list[idx];
}

function resolveMediaPath(relPath) {
  const p = String(relPath || "").trim();
  if (!p) return null;
  const cleaned = p.replace(/^(\.\/)+/, "").replace(/^\/+/, "");
  return path.resolve(BOT_DIR, cleaned);
}

function isMenuLike(lower) {
  return (
    lower === "1" || lower === "2" || lower === "3" ||
    lower.includes("produto") || lower.includes("simula") ||
    lower.includes("humano") || lower.includes("atendente") || lower.includes("corretor") ||
    lower === "menu" || lower === "reiniciar" || lower === "cancelar" ||
    lower === "reativar" ||
    lower === "produtos" || lower === "casas" || lower === "empreendimentos"
  );
}

module.exports = function attachHandlers(client) {
  installHooksOnce();
  client.removeAllListeners("message");

  console.log("✅ Handlers anexados (memória leve + tipo renda CLT/PJ + humanize)");

  async function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function pickAck(cfg){
    const arr = cfg?.humanize?.ackPhrases;
    if(!Array.isArray(arr) || !arr.length) return "";
    return arr[Math.floor(Math.random() * arr.length)];
  }

  async function sendTo(from, text, cfg) {
    const c = ensureSimulation(ensureHumanize(ensureTexts(cfg || readConfigFresh())));

    if (c.humanize.typing) {
      try { await client.sendPresenceAvailable(); } catch {}
      try { await client.sendTyping(from); } catch {}
    }

    if (c.humanize.enabled) {
      const min = Math.max(0, Number(c.humanize.minDelayMs) || 0);
      const max = Math.max(min, Number(c.humanize.maxDelayMs) || min);
      const delay = Math.floor(min + Math.random() * (max - min + 1));
      await sleep(delay);
    }

    await client.sendMessage(from, String(text || ""));
  }

  async function lockToHuman(from, locks, cfg) {
    locks.lockedContacts = Array.isArray(locks.lockedContacts) ? locks.lockedContacts : [];
    if (!locks.lockedContacts.includes(from)) locks.lockedContacts.push(from);
    safeWriteJson(LOCKS_PATH, locks);

    await sendTo(
      from,
      (cfg.humanMessage || "Certo! Em instantes um humano vai te atender ✅") +
        "\n\nPara voltar ao bot: *reativar*",
      cfg
    );
  }

  async function sendMenu(from, cfg, withGreeting = true) {
    const g = cfg.greeting || "Olá! 😊";
    const menu = cfg.menu || "1) Produto\n2) Simulação\n3) Humano";
    await sendTo(from, withGreeting ? `${g}\n${menu}` : menu, cfg);
  }

  async function sendMiniMenu(from, cfg) {
    const multi = hasMultipleProducts(cfg);
    await sendTo(from, multi ? cfg.texts.miniMenu : cfg.texts.miniMenuSingle, cfg);
  }

  async function sendProductSummary(from, cfg, allSessions) {
    const p = getSelectedProduct(cfg, from, allSessions);

    if(!p){
      await sendTo(from, "⚠️ Nenhum produto cadastrado no painel.", cfg);
      return;
    }

    const summaryTpl =
      (p.productSummary && String(p.productSummary).trim()) ||
      (cfg.productSummary && String(cfg.productSummary).trim()) ||
      "Perfeito! Aqui vai um resumo:\n\n*{nome}*\n• Valor: {preco}\n• Local: {local}\n\nQuer que eu te envie *fotos e vídeos*?";

    const summary = tpl(summaryTpl, {
      nome: p.nome || "",
      preco: p.preco || "",
      local: p.local || "",
      metragemCasa: p.metragemCasa || "",
      metragemTerreno: p.metragemTerreno || "",
      quartos: p.quartos || "",
      vagas: p.vagas || ""
    });

    const ack = pickAck(cfg);
    if (ack) await sendTo(from, ack, cfg);

    await sendTo(from, summary, cfg);
    await sendMiniMenu(from, cfg);
  }

  async function sendMedia(from, cfg, allSessions) {
    const p = getSelectedProduct(cfg, from, allSessions);

    if(!p){
      await sendTo(from, "⚠️ Nenhum produto cadastrado no painel.", cfg);
      return;
    }

    const fotos = Array.isArray(p.fotos) ? p.fotos : [];
    const videos = Array.isArray(p.videos) ? p.videos : [];

    if (!fotos.length && !videos.length) {
      await sendTo(from, cfg.texts.noMediaAvailable, cfg);
      return;
    }

    await sendTo(from, cfg.texts.sendingMedia, cfg);

    for (const rel of fotos) {
      const full = resolveMediaPath(rel);
      if (!full || !fs.existsSync(full)) {
        console.log("❌ Foto não encontrada:", full);
        continue;
      }
      const media = MessageMedia.fromFilePath(full);
      await client.sendMessage(from, media);
    }

    for (const rel of videos) {
      const full = resolveMediaPath(rel);
      if (!full || !fs.existsSync(full)) {
        console.log("❌ Vídeo não encontrada:", full);
        continue;
      }
      const media = MessageMedia.fromFilePath(full);
      await client.sendMessage(from, media);
    }
  }

  client.on("message", async (msg) => {
    try {
      const from = msg.from || "";
      const body = (msg.body || "").trim();

      console.log("📩 MSG:", from, "|", body);

      if (msg.fromMe) return;
      if (!body) return;
      if (from === "status@broadcast") return;
      if (from.endsWith("@g.us")) return;

      const isContact = from.endsWith("@c.us") || from.endsWith("@lid");
      if (!isContact) return;

      // carrega sessions + limpa antigas
      const allSessions = loadSessions();
      cleanupSessions(allSessions);

      let cfg = readConfigFresh();
      cfg = ensureSimulation(ensureHumanize(ensureTexts(cfg)));

      const locks = safeReadJson(LOCKS_PATH, { respondEnabled: true, lockedContacts: [] });
      if (!locks.respondEnabled) return;

      locks.lockedContacts = Array.isArray(locks.lockedContacts) ? locks.lockedContacts : [];

      // sessão persistente
      const s = getSession(from, allSessions);
      touchSession(from, allSessions);

      if (locks.lockedContacts.includes(from)) {
        if (normalizeText(body) === "reativar") {
          locks.lockedContacts = locks.lockedContacts.filter((x) => x !== from);
          safeWriteJson(LOCKS_PATH, locks);

          resetSession(from, allSessions);
          await sendTo(from, "Certo! Voltei a te atender por aqui 😊", cfg);
          await sendMenu(from, cfg, true);
        }
        return;
      }

      const lower = normalizeText(body);

      // comandos globais
      if (lower === "reiniciar" || lower === "cancelar") {
        resetSession(from, allSessions);
        await sendTo(from, cfg.texts.restartMsg, cfg);
        await sendMenu(from, cfg, true);
        return;
      }

      if (lower === "menu") {
        s.step = "MENU";
        saveSessions(allSessions);
        await sendMenu(from, cfg, false);
        return;
      }

      // atalhos pra listar produtos (só se tiver +1)
      if ((lower === "produtos" || lower === "casas" || lower === "empreendimentos") && hasMultipleProducts(cfg)) {
        s.step = "PRODUTO_ESCOLHA";
        saveSessions(allSessions);
        await sendTo(from, productsListMessage(cfg), cfg);
        return;
      }

      // primeira mensagem -> menu
      if (!s.greeted) {
        s.greeted = true;
        saveSessions(allSessions);
        await sendMenu(from, cfg, true);
        return;
      }

      // ===== MENU =====
      if (s.step === "MENU") {
        if (lower === "1" || lower.includes("produto") || lower.includes("empreendimento")) {
          const list = getProducts(cfg);

          if (list.length > 1) {
            s.step = "PRODUTO_ESCOLHA";
            s.data.awaitingMediaConfirm = false;
            saveSessions(allSessions);
            await sendTo(from, productsListMessage(cfg), cfg);
            return;
          }

          s.step = "PRODUTO";
          s.data.awaitingMediaConfirm = true;
          s.productIndex = 0;
          saveSessions(allSessions);
          await sendProductSummary(from, cfg, allSessions);
          return;
        }

        if (lower === "2" || lower.includes("simula")) {
          s.step = "SIM_1_NOME";
          s.data = {};
          saveSessions(allSessions);
          await sendTo(from, cfg.simulation.askName, cfg);
          return;
        }

        if (lower === "3" || lower.includes("humano") || lower.includes("atendente") || lower.includes("corretor")) {
          await lockToHuman(from, locks, cfg);
          return;
        }

        await sendTo(from, cfg.texts.fallbackMenu, cfg);
        return;
      }

      // ===== ESCOLHA DE PRODUTO =====
      if (s.step === "PRODUTO_ESCOLHA") {
        const n = extractChoiceNumber(body);

        if (n === null) {
          await sendTo(from, cfg.texts.chooseProductNumber, cfg);
          return;
        }

        const list = getProducts(cfg);
        const limit = Math.min(list.length, 20);

        if (n < 1 || n > limit) {
          await sendTo(from, tpl(cfg.texts.invalidProductNumber, { limit: String(limit) }), cfg);
          await sendTo(from, productsListMessage(cfg), cfg);
          return;
        }

        s.productIndex = n - 1;
        s.step = "PRODUTO";
        s.data.awaitingMediaConfirm = true;
        saveSessions(allSessions);

        const chosen = getSelectedProduct(cfg, from, allSessions);
        await sendTo(from, tpl(cfg.texts.productChosen, { nome: chosen?.nome || `Produto ${n}` }), cfg);
        await sendProductSummary(from, cfg, allSessions);
        return;
      }

      // ===== PRODUTO =====
      if (s.step === "PRODUTO") {
        const multi = hasMultipleProducts(cfg);

        if (multi && (lower === "1" || lower.includes("outro") || lower.includes("trocar"))) {
          s.step = "PRODUTO_ESCOLHA";
          s.data.awaitingMediaConfirm = false;
          saveSessions(allSessions);
          await sendTo(from, productsListMessage(cfg), cfg);
          return;
        }

        if (!multi) {
          if (lower === "1" || lower.includes("simula")) {
            s.step = "SIM_1_NOME";
            s.data = {};
            saveSessions(allSessions);
            await sendTo(from, cfg.simulation.askName, cfg);
            return;
          }

          if (lower === "2" || lower.includes("humano") || lower.includes("atendente") || lower.includes("corretor")) {
            await lockToHuman(from, locks, cfg);
            s.step = "MENU";
            saveSessions(allSessions);
            return;
          }
        } else {
          if (lower === "2" || lower.includes("simula")) {
            s.step = "SIM_1_NOME";
            s.data = {};
            saveSessions(allSessions);
            await sendTo(from, cfg.simulation.askName, cfg);
            return;
          }

          if (lower === "3" || lower.includes("humano") || lower.includes("atendente") || lower.includes("corretor")) {
            await lockToHuman(from, locks, cfg);
            s.step = "MENU";
            saveSessions(allSessions);
            return;
          }
        }

        if (lower === "menu") {
          s.step = "MENU";
          saveSessions(allSessions);
          await sendMenu(from, cfg, false);
          return;
        }

        if (s.data.awaitingMediaConfirm) {
          const yn = parseYesNoWithCfg(body, cfg);

          if (yn === null) {
            await sendTo(from, cfg.texts.askMediaAgain, cfg);
            await sendMiniMenu(from, cfg);
            return;
          }

          s.data.awaitingMediaConfirm = false;
          saveSessions(allSessions);

          if (yn) {
            await sendMedia(from, cfg, allSessions);
            await sendTo(from, "✅ Pronto! Quer fazer algo mais?", cfg);
            await sendMiniMenu(from, cfg);
            return;
          }

          await sendTo(from, cfg.texts.noMediaOk, cfg);
          await sendMiniMenu(from, cfg);
          return;
        }

        await sendMiniMenu(from, cfg);
        return;
      }

      // ===== SIMULAÇÃO (AGORA COM TIPO DE RENDA SEPARADO) =====
      if (s.step === "SIM_1_NOME") {
        s.data.nome = body;
        s.step = "SIM_2_CPF";
        saveSessions(allSessions);
        await sendTo(from, cfg.simulation.askCPF, cfg);
        return;
      }

      if (s.step === "SIM_2_CPF") {
        const cpf = normalizeCPF(body);
        if (!isValidCPFFormat(cpf)) {
          await sendTo(from, "CPF inválido. Envie novamente (11 dígitos). Ex: 123.456.789-09", cfg);
          return;
        }
        s.data.cpf = cpf;
        s.step = "SIM_3_NASC";
        saveSessions(allSessions);
        await sendTo(from, cfg.simulation.askBirth, cfg);
        return;
      }

      if (s.step === "SIM_3_NASC") {
        const dt = normalizeDateBR(body);
        if (!dt) {
          await sendTo(from, "Data inválida. Use o formato *DD/MM/AAAA*. Ex: 10/11/2007", cfg);
          return;
        }
        s.data.nascimento = dt;

        // ✅ agora pergunta TIPO antes do resto
        s.step = "SIM_3B_TIPO";
        saveSessions(allSessions);

        // dica amigável (pode tirar se não quiser)
        await sendTo(from, cfg.simulation.askType + "\n\n(Responda: CLT ou PJ)", cfg);
        return;
      }

      if (s.step === "SIM_3B_TIPO") {
        const tipo = parseIncomeType(body);
        if (!tipo) {
          await sendTo(from, "Não entendi 😅 Você é *CLT* ou *PJ*?", cfg);
          return;
        }

        s.data.tipo = tipo;

        if (tipo === "CLT") {
          s.step = "SIM_3C_CLT3";
          saveSessions(allSessions);
          await sendTo(from, cfg.simulation.ask3Years, cfg);
          return;
        }

        // PJ
        s.step = "SIM_3D_PJTIME";
        saveSessions(allSessions);
        await sendTo(from, cfg.simulation.askPJTime, cfg);
        return;
      }

      if (s.step === "SIM_3C_CLT3") {
        const yn = parseYesNoWithCfg(body, cfg);
        if (yn === null) {
          await sendTo(from, "Pode responder tipo: *sim*, *claro*… ou *não*, *agora não* 🙂", cfg);
          return;
        }
        s.data.clt3anos = yn ? "Sim" : "Não";
        s.data.pjTempo = ""; // limpa
        s.step = "SIM_4_FIRSTHOME";
        saveSessions(allSessions);
        await sendTo(from, cfg.simulation.askFirstHome, cfg);
        return;
      }

      if (s.step === "SIM_3D_PJTIME") {
        // aqui é texto livre (ex: "2 anos", "6 meses")
        s.data.pjTempo = body;
        s.data.clt3anos = ""; // limpa
        s.step = "SIM_4_FIRSTHOME";
        saveSessions(allSessions);
        await sendTo(from, cfg.simulation.askFirstHome, cfg);
        return;
      }

      if (s.step === "SIM_4_FIRSTHOME") {
        const yn = parseYesNoWithCfg(body, cfg);
        if (yn === null) {
          await sendTo(from, "Pode responder tipo: *sim* / *não* 🙂", cfg);
          return;
        }
        s.data.primeiroImovel = yn ? "Sim" : "Não";
        s.step = "SIM_5_PENDENCIAS";
        saveSessions(allSessions);
        await sendTo(from, cfg.simulation.askHasDebts, cfg);
        return;
      }

      if (s.step === "SIM_5_PENDENCIAS") {
        const yn = parseYesNoWithCfg(body, cfg);
        if (yn === null) {
          await sendTo(from, "Pode responder tipo: *sim* / *não* 🙂", cfg);
          return;
        }
        s.data.pendencias = yn ? "Sim" : "Não";
        s.step = "SIM_6_DEPENDENTES";
        saveSessions(allSessions);
        await sendTo(from, cfg.simulation.askDependents, cfg);
        return;
      }

      if (s.step === "SIM_6_DEPENDENTES") {
        const yn = parseYesNoWithCfg(body, cfg);
        if (yn === null) {
          await sendTo(from, "Pode responder tipo: *sim* / *não* 🙂", cfg);
          return;
        }

        if (yn) {
          s.step = "SIM_6B_DEP_COUNT";
          saveSessions(allSessions);
          await sendTo(from, cfg.simulation.askDependentsCount, cfg);
          return;
        }

        s.data.dependentes = "Não";
        s.step = "SIM_7_DONE";
        saveSessions(allSessions);
      }

      if (s.step === "SIM_6B_DEP_COUNT") {
        const n = Number(String(body).replace(/[^\d]/g, ""));
        if (!Number.isFinite(n) || n < 0 || n > 20) {
          await sendTo(from, "Me diga só um número 🙂 Ex: 0, 1, 2...", cfg);
          return;
        }
        s.data.dependentes = String(n);
        s.step = "SIM_7_DONE";
        saveSessions(allSessions);
      }

      if (s.step === "SIM_7_DONE") {
        const doneTpl = cfg.simulation.donePF;

        await sendTo(from, tpl(doneTpl, {
          nome: s.data.nome || "",
          cpfMask: maskCPF(s.data.cpf || ""),
          nascimento: s.data.nascimento || "",
          tipo: s.data.tipo || "",
          clt3anos: s.data.clt3anos || "",
          pjTempo: s.data.pjTempo || "",
          primeiroImovel: s.data.primeiroImovel || "",
          pendencias: s.data.pendencias || "",
          dependentes: s.data.dependentes || ""
        }), cfg);

        s.step = "SIM_8_VISITA";
        saveSessions(allSessions);
        await sendTo(from, cfg.simulation.askVisit, cfg);
        return;
      }

      if (s.step === "SIM_8_VISITA") {
        const yn = parseYesNoWithCfg(body, cfg);
        if (yn === null) {
          await sendTo(from, "Pode responder tipo: *sim* / *não* 🙂", cfg);
          return;
        }

        if (yn) {
          await sendTo(from, "Perfeito! Vou chamar um corretor pra agendar com você ✅", cfg);
        } else {
          await sendTo(from, "Tudo bem! Vou chamar um corretor pra te ajudar do mesmo jeito ✅", cfg);
        }

        await lockToHuman(from, locks, cfg);
        s.step = "MENU";
        saveSessions(allSessions);
        return;
      }

      // ===== FALLBACK =====
      if (!isMenuLike(lower)) {
        await sendTo(from, 'Para continuar, digite "menu" e escolha 1, 2 ou 3.', cfg);
        return;
      }

      s.step = "MENU";
      saveSessions(allSessions);
      await sendTo(from, 'Digite "menu" para ver as opções.', cfg);
    } catch (e) {
      console.log("❌ ERRO handler:", e);
    }
  });
};
