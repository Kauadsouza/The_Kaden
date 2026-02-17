// whatsapp-bot/botRuntime.js
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");

const attachHandlers = require("./botHandlers");

let client = null;
let started = false;
let connected = false;
let lastQr = null;
let lastError = null;

function status() {
  return { started, connected, lastError };
}

function getQr() {
  return { qr: lastQr };
}

async function start() {
  if (started) {
    console.log("⚠️ Bot já está rodando, start ignorado.");
    return;
  }

  started = true;
  connected = false;
  lastError = null;
  lastQr = null;

  console.log("🚀 Iniciando bot...");

  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
  });

  // QR
  client.on("qr", async (qr) => {
    lastQr = await qrcode.toDataURL(qr);
    console.log("📲 QR Code gerado");
  });

  // Autenticado
  client.on("authenticated", () => {
    console.log("🔐 AUTHENTICATED (sessão criada)");
  });

  // Ready
  client.on("ready", () => {
    connected = true;
    console.log("🚀 BOT READY (conectado e pronto pra responder)");
  });

  // Erro
  client.on("auth_failure", (msg) => {
    lastError = msg;
    console.log("❌ AUTH FAILURE:", msg);
  });

  client.on("disconnected", (reason) => {
    console.log("🔌 Bot desconectado:", reason);
    connected = false;
    started = false;
    client = null;
  });

  // 🔥 handlers anexados UMA VEZ
  attachHandlers(client);

  await client.initialize();
}

async function stop() {
  if (!started || !client) {
    console.log("⚠️ Bot já está parado.");
    return;
  }

  console.log("🛑 Parando bot...");
  try {
    await client.destroy();
  } catch (e) {
    console.log("Erro ao destruir client:", e);
  }

  client = null;
  started = false;
  connected = false;
  lastQr = null;

  console.log("🛑 Bot parado.");
}

module.exports = {
  start,
  stop,
  status,
  getQr
};
