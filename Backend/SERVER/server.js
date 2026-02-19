"use strict";

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config();

const { createProxyMiddleware } = require("http-proxy-middleware");
const { spawn } = require("child_process");

// ✅ Mercado Pago SDK NOVO (mercadopago v2+)
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

const db = require("./db");

const app = express();

// ===============================
// CONFIG
// ===============================
const PORT = Number(process.env.PORT || 3001);

const JWT_SECRET = (process.env.JWT_SECRET || "").trim();
if (!JWT_SECRET) {
  console.error("❌ Falta JWT_SECRET no .env");
  process.exit(1);
}

const FRONTEND_URL = (process.env.FRONTEND_URL || "").trim();

// ✅ Mercado Pago
const MP_ACCESS_TOKEN = (process.env.MP_ACCESS_TOKEN || "").trim();
let mpClient = null;

if (!MP_ACCESS_TOKEN) {
  console.warn("⚠️ MP_ACCESS_TOKEN não encontrado no .env (pagamentos não vão funcionar ainda).");
} else {
  mpClient = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
}

// Bot interno (whatsapp-bot)
const BOT_HOST = (process.env.BOT_HOST || "http://localhost:3333").trim();
const AUTO_START_BOT =
  String(process.env.AUTO_START_BOT || "true").toLowerCase() === "true";

// ✅ server.js em: Backend/SERVER/server.js
// ✅ ROOT do projeto: THE KADEN/
const ROOT_DIR = path.resolve(__dirname, "..", "..");

// ✅ LOGIN (Frontend)
const FRONT_DIR = path.join(ROOT_DIR, "Frontend");
const LOGIN_INDEX = path.join(FRONT_DIR, "index.html");

// ✅ CHATBOT (CHAT BOT/public)  -> seu app web
const CHATBOT_PUBLIC_DIR = path.join(ROOT_DIR, "CHAT BOT", "public");
const CHATBOT_INDEX = path.join(CHATBOT_PUBLIC_DIR, "index.html");

// ✅ WHATSAPP BOT (serviço que gera QR etc)
// ⚠️ ATENÇÃO: pelo seu print, o entry DO WHATSAPP BOT está em:
// THE KADEN/CHAT BOT/whatsapp-bot/server.js
const WHATSAPP_BOT_DIR = path.join(ROOT_DIR, "CHAT BOT", "whatsapp-bot");
const WHATSAPP_BOT_ENTRY = path.join(WHATSAPP_BOT_DIR, "server.js");

// ===============================
// HELPERS
// ===============================
app.set("trust proxy", 1);

function getBaseUrl(req) {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http");
  const host = String(req.headers["x-forwarded-host"] || req.get("host") || `localhost:${PORT}`);
  return `${proto}://${host}`;
}

// ✅ 3 planos (edite os valores como quiser)
const PLANS = {
  starter: { title: "The Kaden Starter", price: 97.0 },
  professional: { title: "The Kaden Professional", price: 197.0 },
  business: { title: "The Kaden Business", price: 397.0 },
};

// ===============================
// MIDDLEWARES
// ===============================
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false })); // ✅ ajuda webhook/form

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);

      const allowed = new Set([
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
      ]);

      if (FRONTEND_URL) allowed.add(FRONTEND_URL);

      if (allowed.has(origin)) return cb(null, true);
      return cb(new Error("CORS bloqueado: " + origin));
    },
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ===============================
// (1) PROXY DO PAINEL DO WHATSAPP-BOT
// ===============================
app.use(
  "/bot",
  createProxyMiddleware({
    target: BOT_HOST,
    changeOrigin: true,
    ws: true,
    pathRewrite: { "^/bot": "" },
    logLevel: "warn",
  })
);

app.use(
  "/api/bot",
  createProxyMiddleware({
    target: BOT_HOST,
    changeOrigin: true,
    ws: true,
    logLevel: "warn",
  })
);

// ===============================
// (2) SERVIR LOGIN (Frontend) em "/"
// ===============================
app.use(express.static(FRONT_DIR, { index: false }));

app.get("/", (req, res) => {
  return res.sendFile(LOGIN_INDEX, (err) => {
    if (err) return res.status(404).send("❌ index.html não encontrado em /Frontend.");
  });
});

// ===============================
// (3) SERVIR CHATBOT WEB em "/app"
// ===============================
app.use("/app", express.static(CHATBOT_PUBLIC_DIR, { index: false }));

app.get(["/app", "/app/"], (req, res) => {
  return res.sendFile(CHATBOT_INDEX, (err) => {
    if (err) return res.status(404).send("❌ index.html não encontrado em /CHAT BOT/public.");
  });
});

// ===============================
// HELPERS JWT
// ===============================
function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Token ausente." });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Token inválido/expirado." });
  }
}

// ===============================
// ROTAS API (seu backend)
// ===============================
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/db-test", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT 1 AS ok");
    res.json({ ok: true, rows });
  } catch (e) {
    console.error("DB TEST ERROR:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------- AUTH ----------
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password, fullName, company, personType, doc } = req.body || {};

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Preencha username, email e password." });
    }

    const exists = await db.query(
      "SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1",
      [email, username]
    );
    if (exists.rows.length) {
      return res.status(409).json({ error: "Usuário ou email já cadastrado." });
    }

    const password_hash = await bcrypt.hash(String(password), 10);

    await db.query(
      `INSERT INTO users (username, email, full_name, company_name, person_type, doc, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [username, email, fullName ?? null, company ?? null, personType ?? null, doc ?? null, password_hash]
    );

    const created = await db.query(
      "SELECT id, username, email FROM users WHERE email = $1 LIMIT 1",
      [email]
    );

    const user = created.rows[0];
    const token = signToken(user);

    return res.status(201).json({ ok: true, token, user });
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    return res.status(500).json({ error: "Erro interno no cadastro." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { password, userOrEmail, email } = req.body || {};
    const loginId = String(userOrEmail || email || "").trim();

    if (!loginId || !password) {
      return res.status(400).json({ error: "Preencha email/usuário e password." });
    }

    const r = await db.query(
      "SELECT id, username, email, password_hash FROM users WHERE email = $1 OR username = $1 LIMIT 1",
      [loginId]
    );

    if (!r.rows.length) {
      return res.status(401).json({ error: "Email/usuário ou senha inválidos." });
    }

    const userRow = r.rows[0];
    const ok = await bcrypt.compare(String(password), userRow.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Email/usuário ou senha inválidos." });
    }

    const token = signToken(userRow);

    return res.json({
      ok: true,
      token,
      user: { id: userRow.id, username: userRow.username, email: userRow.email },
    });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return res.status(500).json({ error: "Erro interno no login." });
  }
});

app.get("/api/me", auth, async (req, res) => {
  try {
    const r = await db.query(
      "SELECT id, username, email, full_name, company_name, person_type, doc, created_at FROM users WHERE id = $1 LIMIT 1",
      [req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Usuário não existe." });
    return res.json({ ok: true, user: r.rows[0] });
  } catch (e) {
    console.error("ME ERROR:", e);
    return res.status(500).json({ error: "Erro interno." });
  }
});

// ===============================
// ✅ MERCADO PAGO — CRIAR PAGAMENTO (Checkout Pro)
// POST /api/create-payment  { plan: "starter"|"professional"|"business" }
// ===============================
app.post("/api/create-payment", auth, async (req, res) => {
  try {
    if (!mpClient) return res.status(500).json({ error: "MP_ACCESS_TOKEN não configurado no .env" });

    const { plan } = req.body || {};
    const planKey = String(plan || "").toLowerCase().trim();

    if (!PLANS[planKey]) {
      return res.status(400).json({ error: "Plano inválido. Use: starter, professional, business" });
    }

    const baseUrl = getBaseUrl(req);

    const preference = new Preference(mpClient);

    const response = await preference.create({
      body: {
        items: [
          {
            title: PLANS[planKey].title,
            quantity: 1,
            unit_price: Number(PLANS[planKey].price),
            currency_id: "BRL",
          },
        ],

        external_reference: JSON.stringify({
          userId: req.user.id,
          plan: planKey,
        }),

        back_urls: {
          success: `${baseUrl}/payment-success`,
          failure: `${baseUrl}/payment-failure`,
          pending: `${baseUrl}/payment-pending`,
        },
        auto_return: "approved",

        metadata: {
          userId: req.user.id,
          plan: planKey,
        },

        // ✅ webhook
        notification_url: `${baseUrl}/api/mp/webhook`,
      },
    });

    return res.json({
      ok: true,
      plan: planKey,
      preference_id: response.id,
      init_point: response.init_point,
      sandbox_init_point: response.sandbox_init_point,
    });
  } catch (e) {
    console.error("MP CREATE PAYMENT ERROR:", e);
    return res.status(500).json({ error: "Erro ao criar pagamento no Mercado Pago." });
  }
});

// ===============================
// ✅ MERCADO PAGO — WEBHOOK (NOTIFICAÇÕES)
// ===============================
app.post("/api/mp/webhook", async (req, res) => {
  try {
    // responde rápido
    res.sendStatus(200);

    if (!mpClient) return;

    const type = req.body?.type || req.query?.type;
    const dataId =
      req.body?.data?.id ||
      req.query?.["data.id"] ||
      req.body?.id;

    if (String(type) !== "payment" || !dataId) return;

    const paymentApi = new Payment(mpClient);
    const pay = await paymentApi.get({ id: String(dataId) });

    const status = pay?.status || "unknown";
    const extRef = pay?.external_reference || "";

    let userId = null;
    let plan = null;
    try {
      const parsed = JSON.parse(extRef);
      userId = parsed?.userId ?? null;
      plan = parsed?.plan ?? null;
    } catch {}

    // ✅ ativa plano no banco (quando approved)
    if (userId && plan && status === "approved") {
      // ⚠️ Só funciona se existir coluna users.plan
      try {
        await db.query("UPDATE users SET plan = $1 WHERE id = $2", [plan, userId]);
      } catch (e) {
        console.log("⚠️ Não consegui atualizar users.plan (talvez coluna não exista):", e.message);
      }
    }

    console.log("✅ Webhook MP recebido:", { type, dataId, status, userId, plan });
  } catch (e) {
    console.error("MP WEBHOOK ERROR:", e);
  }
});

// páginas de retorno (evita 404)
app.get("/payment-success", (req, res) => res.send("✅ Pagamento aprovado! Pode voltar pro The Kaden."));
app.get("/payment-failure", (req, res) => res.send("❌ Pagamento falhou. Tente novamente."));
app.get("/payment-pending", (req, res) => res.send("⏳ Pagamento pendente. Assim que confirmar, seu plano libera."));

// ===============================
// AUTO START DO WHATSAPP-BOT (opcional)
// ===============================
function startWhatsAppBot() {
  try {
    const child = spawn(process.execPath, [WHATSAPP_BOT_ENTRY], {
      cwd: WHATSAPP_BOT_DIR,
      stdio: "inherit",
      env: process.env,
      shell: true,
    });

    child.on("exit", (code) => {
      console.log(`⚠️ whatsapp-bot saiu com code ${code}`);
    });

    console.log("✅ whatsapp-bot iniciado automaticamente (interno).");
  } catch (e) {
    console.log("⚠️ Não consegui iniciar whatsapp-bot automaticamente:", e.message);
  }
}

// ===============================
// START
// ===============================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend online na porta ${PORT}`);
  console.log(`➡️  Abra: http://localhost:${PORT}/`);
  console.log(`➡️  App:  http://localhost:${PORT}/app`);
  console.log(`➡️  Bot:  http://localhost:${PORT}/bot`);
  console.log(`➡️  MP:   POST http://localhost:${PORT}/api/create-payment`);
  console.log(`➡️  Hook: POST http://localhost:${PORT}/api/mp/webhook`);

  if (AUTO_START_BOT) startWhatsAppBot();
});
