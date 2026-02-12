// Backend/SERVER/server.js
"use strict";

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config();
const db = require("./db");

const app = express();

// ===============================
// CONFIG
// ===============================
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET;

// Em produção (Render), defina FRONTEND_URL com a URL do seu front
// Ex: https://the-kaden.vercel.app  (ou outro host)
const FRONTEND_URL = (process.env.FRONTEND_URL || "").trim();

if (!JWT_SECRET) {
  console.error("❌ Falta JWT_SECRET no .env / env vars");
  process.exit(1);
}

// ===============================
// MIDDLEWARES
// ===============================
app.use(express.json({ limit: "1mb" }));

// ✅ CORS (local + produção)
app.use(
  cors({
    origin: (origin, cb) => {
      // permite chamadas sem origin (Postman, curl)
      if (!origin) return cb(null, true);

      const allowed = [
        // Backend
        "http://localhost:3001",
        "http://127.0.0.1:3001",

        // Live Server (VS Code)
        "http://localhost:5500",
        "http://127.0.0.1:5500",

        // servidores locais comuns
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
      ];

      // Se você definir FRONTEND_URL no Render, ele vira permitido
      if (FRONTEND_URL) allowed.push(FRONTEND_URL);

      if (allowed.includes(origin)) return cb(null, true);

      // (opcional) se seu front tiver subdomínios, você pode liberar por pattern aqui
      // if (origin.endsWith(".seusite.com")) return cb(null, true);

      return cb(new Error("CORS bloqueado: " + origin));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ===============================
// SERVIR FRONTEND (opcional)
// ===============================
// Se você quiser servir o Frontend pelo mesmo backend (Render), pode manter.
// Caso vá hospedar front separado (Vercel/Netlify), isso não atrapalha.
const FRONT_DIR = path.join(__dirname, "..", "..", "Frontend");
app.use(express.static(FRONT_DIR));

app.get("/", (req, res) => {
  // Se existir index.html, serve. Se não, responde ok.
  const indexPath = path.join(FRONT_DIR, "index.html");
  return res.sendFile(indexPath, (err) => {
    if (err) return res.json({ ok: true, msg: "API online." });
  });
});

// ===============================
// HELPERS
// ===============================
function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function auth(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";

    if (!token) return res.status(401).json({ error: "Token ausente." });

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

// ===============================
// ROTAS
// ===============================
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/db-test", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 AS ok");
    res.json({ ok: true, rows });
  } catch (e) {
    console.error("DB TEST ERROR:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ✅ REGISTER
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password, fullName, company, personType, doc } =
      req.body || {};

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: "Preencha username, email e password." });
    }

    // email OU username já existe?
    const [exists] = await db.query(
      "SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1",
      [email, username]
    );
    if (exists.length) {
      return res.status(409).json({ error: "Usuário ou email já cadastrado." });
    }

    const password_hash = await bcrypt.hash(String(password), 10);

    const full_name = fullName ?? null;
    const company_name = company ?? null;
    const person_type = personType ?? null;
    const doc_val = doc ?? null;

    await db.query(
      `INSERT INTO users (username, email, full_name, company_name, person_type, doc, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, email, full_name, company_name, person_type, doc_val, password_hash]
    );

    const [rows] = await db.query(
      "SELECT id, username, email FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    const token = signToken(rows[0]);

    return res.status(201).json({ ok: true, token, user: rows[0] });
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    return res.status(500).json({ error: "Erro interno no cadastro." });
  }
});

// ✅ LOGIN (aceita EMAIL ou USERNAME)
// Front pode mandar { userOrEmail, password } ou { email, password }
app.post("/api/login", async (req, res) => {
  try {
    const { password, userOrEmail, email } = req.body || {};
    const loginId = String(userOrEmail || email || "").trim();

    if (!loginId || !password) {
      return res
        .status(400)
        .json({ error: "Preencha email/usuário e password." });
    }

    const [rows] = await db.query(
      "SELECT id, username, email, password_hash FROM users WHERE email = ? OR username = ? LIMIT 1",
      [loginId, loginId]
    );

    if (!rows.length) {
      return res.status(401).json({ error: "Email/usuário ou senha inválidos." });
    }

    const ok = await bcrypt.compare(String(password), rows[0].password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Email/usuário ou senha inválidos." });
    }

    const token = signToken(rows[0]);

    return res.json({
      ok: true,
      token,
      user: { id: rows[0].id, username: rows[0].username, email: rows[0].email },
    });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return res.status(500).json({ error: "Erro interno no login." });
  }
});

// ✅ QUEM SOU EU? (rota protegida)
app.get("/api/me", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, username, email, full_name, company_name, person_type, doc, created_at FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );

    if (!rows.length) return res.status(404).json({ error: "Usuário não existe." });

    return res.json({ ok: true, user: rows[0] });
  } catch (e) {
    console.error("ME ERROR:", e);
    return res.status(500).json({ error: "Erro interno." });
  }
});

// ===============================
// START
// ===============================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend online na porta ${PORT}`);
  console.log(`✅ FRONTEND_URL permitido: ${FRONTEND_URL || "(não definido)"}`);
  console.log(`✅ Frontend (se existir) servido de: ${FRONT_DIR}`);
});
