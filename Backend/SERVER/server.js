"use strict";

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config();

const { createProxyMiddleware } = require("http-proxy-middleware");
const { spawn } = require("child_process");

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

// Bot interno (whatsapp-bot) — você NÃO vai abrir no navegador,
// mas ele precisa rodar para gerar QR/status.
const BOT_HOST = (process.env.BOT_HOST || "http://localhost:3333").trim();
const AUTO_START_BOT = String(process.env.AUTO_START_BOT || "true").toLowerCase() === "true";

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
const WHATSAPP_BOT_DIR = path.join(ROOT_DIR, "CHAT BOT", "whatsapp-bot");
const WHATSAPP_BOT_ENTRY = path.join(WHATSAPP_BOT_DIR, "server.js");

// ===============================
// MIDDLEWARES
// ===============================
app.use(express.json({ limit: "1mb" }));

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
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ===============================
// (1) PROXY DO PAINEL DO WHATSAPP-BOT
// Você acessa SÓ o 3001:
//   http://localhost:3001/bot    -> painel do bot (que roda internamente em 3333)
//   http://localhost:3001/api/bot/* -> api do bot (se existir)
// ===============================

// /bot -> (proxy) -> http://localhost:3333/
app.use(
  "/bot",
  createProxyMiddleware({
    target: BOT_HOST,
    changeOrigin: true,
    ws: true,
    pathRewrite: { "^/bot": "" }, // /bot vira / no serviço do bot
    logLevel: "warn",
  })
);

// /api/bot -> (proxy) -> http://localhost:3333/api/bot
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

app.get("/app", (req, res) => {
  return res.sendFile(CHATBOT_INDEX, (err) => {
    if (err) return res.status(404).send("❌ index.html não encontrado em /CHAT BOT/public.");
  });
});

app.get("/app/", (req, res) => {
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
// AUTO START DO WHATSAPP-BOT (opcional)
// Assim você roda só o 3001 e ele liga o bot sozinho.
// ===============================
function startWhatsAppBot() {
  try {
    // só tenta se existir o arquivo
    // (não vamos dar crash se você ainda não quiser)
    const child = spawn(process.execPath, [WHATSAPP_BOT_ENTRY], {
      cwd: WHATSAPP_BOT_DIR,
      stdio: "inherit",
      env: process.env,
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
  console.log(`✅ Login servido de: ${FRONT_DIR}`);
  console.log(`✅ App (chatbot web) servido de: ${CHATBOT_PUBLIC_DIR}`);
  console.log(`✅ Proxy bot: /bot -> ${BOT_HOST}`);
  console.log(`➡️  Abra: http://localhost:${PORT}/`);
  console.log(`➡️  Após login: http://localhost:${PORT}/app`);
  console.log(`➡️  Painel do WhatsApp (no MESMO 3001): http://localhost:${PORT}/bot`);

  if (AUTO_START_BOT) startWhatsAppBot();
});
