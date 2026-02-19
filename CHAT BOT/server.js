// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const bot = require("./whatsapp-bot/botRuntime.js");

const app = express();

// Se seu painel/front estiver em outro domínio/porta, descomente:
// const cors = require("cors");
// app.use(cors());

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

// evita "Cannot GET /"
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ caminhos absolutos (evita salvar config em lugar errado)
const CONFIG_PATH = path.resolve(__dirname, "config.json");
const LOCKS_PATH = path.resolve(__dirname, "locks.json");

// ✅ pasta onde as mídias ficam (o bot já busca em whatsapp-bot/media)
const MEDIA_DIR = path.resolve(__dirname, "whatsapp-bot", "media");
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

// ==================== Helpers ====================
function ensureFile(p, defaultObj) {
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify(defaultObj, null, 2), "utf-8");
  }
}

function safeParseJson(text) {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e?.message || "JSON inválido" };
  }
}

function readJson(p, fallback) {
  try {
    ensureFile(p, fallback);
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = safeParseJson(raw);
    if (!parsed.ok) return fallback;
    return parsed.data ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(p, data) {
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, p);
}

// merge profundo simples (pra PATCH)
function deepMerge(target, patch) {
  if (patch === null || patch === undefined) return target;
  if (Array.isArray(patch)) return patch; // arrays: substitui
  if (typeof patch !== "object") return patch; // primitivos: substitui

  const out = { ...(target && typeof target === "object" ? target : {}) };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = deepMerge(out[k], v);
  }
  return out;
}

// ✅ validação compatível com products (novo) + product (antigo)
function validateConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return "Config deve ser um objeto.";

  if (cfg.greeting && typeof cfg.greeting !== "string") return "greeting deve ser string.";
  if (cfg.menu && typeof cfg.menu !== "string") return "menu deve ser string.";

  // product (compat antigo)
  if (cfg.product && typeof cfg.product !== "object") return "product deve ser objeto.";
  if (cfg.product?.fotos && !Array.isArray(cfg.product.fotos)) return "product.fotos deve ser array.";
  if (cfg.product?.videos && !Array.isArray(cfg.product.videos)) return "product.videos deve ser array.";

  // products (novo)
  if (cfg.products && !Array.isArray(cfg.products)) return "products deve ser array.";
  if (Array.isArray(cfg.products)) {
    for (const [i, p] of cfg.products.entries()) {
      if (p && typeof p !== "object") return `products[${i}] deve ser objeto.`;
      if (p?.nome && typeof p.nome !== "string") return `products[${i}].nome deve ser string.`;
      if (p?.productSummary && typeof p.productSummary !== "string")
        return `products[${i}].productSummary deve ser string.`;
      if (p?.fotos && !Array.isArray(p.fotos)) return `products[${i}].fotos deve ser array.`;
      if (p?.videos && !Array.isArray(p.videos)) return `products[${i}].videos deve ser array.`;
    }
  }

  return null; // ok
}

// ==================== Defaults ====================
const DEFAULT_CONFIG = {
  greeting: "Olá! 😊",
  menu:
    "Como posso te ajudar hoje?\n\n" +
    "1) Saber mais sobre o produto\n" +
    "2) Fazer uma simulação\n" +
    "3) Falar com um humano\n\n" +
    'Digite 1, 2 ou 3. (ou "menu")\n' +
    'Para reiniciar: "reiniciar"',
  humanMessage: "Certo! Em instantes entraremos em contato!!",
  afterMedia: "Se quiser, posso fazer uma *simulação* agora. Digite 2 ou simular.",
  productSummary:
    "Perfeito! Aqui vai um resumo:\n\n*{nome}*\n• Valor: {preco}\n• Local: {local}\n\nQuer que eu te envie *fotos e vídeos*? (sim/não)",

  // ✅ novo modelo (mult-produtos)
  products: [
    {
      nome: "Residencial Example",
      preco: "R$ 250.000,00",
      local: "Zona sul",
      metragemCasa: "46m²",
      metragemTerreno: "126m²",
      quartos: "2 quartos",
      vagas: "2 vagas",
      fotos: [],
      videos: [],
      productSummary: "",
    },
  ],

  // ✅ compat antigo (mantido)
  product: {
    nome: "Residencial Example",
    preco: "R$ 250.000,00",
    local: "Zona sul",
    metragemCasa: "46m²",
    metragemTerreno: "126m²",
    quartos: "2 quartos",
    vagas: "2 vagas",
    fotos: [],
    videos: [],
  },
};

const DEFAULT_LOCKS = { respondEnabled: true, lockedContacts: [] };

ensureFile(CONFIG_PATH, DEFAULT_CONFIG);
ensureFile(LOCKS_PATH, DEFAULT_LOCKS);

// ==================== UPLOAD (multer) ====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEDIA_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const base = path
      .basename(file.originalname || "file", ext)
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);

    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    cb(null, `${base}-${unique}${ext}`);
  },
});

const allowedMime = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime", // .mov
]);

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    if (!allowedMime.has(file.mimetype)) {
      return cb(new Error("Tipo de arquivo não permitido. Use JPG/PNG/WEBP/MP4/MOV."));
    }
    cb(null, true);
  },
});

// rota: recebe file -> retorna path "media/arquivo.ext"
app.post("/api/media/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "Arquivo não enviado." });
    const rel = `media/${req.file.filename}`;
    res.json({ ok: true, path: rel, filename: req.file.filename });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "Erro no upload." });
  }
});

// ✅ remover mídia (apaga arquivo físico)
app.post("/api/media/delete", (req, res) => {
  try {
    const rel = String(req.body?.path || "").trim(); // ex: "media/abc.mp4"
    if (!rel.startsWith("media/")) {
      return res.status(400).json({ ok: false, error: "Path inválido." });
    }

    const full = path.join(MEDIA_DIR, rel.replace(/^media\//, ""));
    const resolved = path.resolve(full);
    const baseResolved = path.resolve(MEDIA_DIR);

    if (!resolved.startsWith(baseResolved)) {
      return res.status(400).json({ ok: false, error: "Path inválido." });
    }

    if (!fs.existsSync(resolved)) return res.json({ ok: true, removed: false });

    fs.unlinkSync(resolved);
    return res.json({ ok: true, removed: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Erro ao remover." });
  }
});

// handler de erro do multer (resposta amigável)
app.use((err, req, res, next) => {
  if (!err) return next();
  res.status(400).json({ ok: false, error: err.message || "Erro." });
});

// ==================== Config / Locks ====================

// GET config
app.get("/api/config", (req, res) => {
  const cfg = readJson(CONFIG_PATH, DEFAULT_CONFIG);
  res.json(cfg);
});

// PUT config (substitui tudo)
app.put("/api/config", (req, res) => {
  const incoming = req.body;

  const err = validateConfig(incoming);
  if (err) return res.status(400).json({ ok: false, error: err });

  writeJsonAtomic(CONFIG_PATH, incoming);
  res.json({ ok: true });
});


app.patch("/api/config", (req, res) => {
  const patch = req.body;

  const current = readJson(CONFIG_PATH, DEFAULT_CONFIG);
  const merged = deepMerge(current, patch);

  const err = validateConfig(merged);
  if (err) return res.status(400).json({ ok: false, error: err });

  writeJsonAtomic(CONFIG_PATH, merged);
  res.json({ ok: true, config: merged });
});

// locks
app.get("/api/locks", (req, res) => res.json(readJson(LOCKS_PATH, DEFAULT_LOCKS)));

app.put("/api/locks", (req, res) => {
  writeJsonAtomic(LOCKS_PATH, req.body);
  res.json({ ok: true });
});

app.patch("/api/locks", (req, res) => {
  const current = readJson(LOCKS_PATH, DEFAULT_LOCKS);
  const merged = deepMerge(current, req.body);
  writeJsonAtomic(LOCKS_PATH, merged);
  res.json({ ok: true, locks: merged });
});

// ==================== Bot runtime ====================
app.get("/api/bot/status", (req, res) => res.json(bot.status()));
app.get("/api/bot/qr", (req, res) => res.json(bot.getQr()));

app.post("/api/bot/start", async (req, res) => {
  await bot.start();
  res.json({ ok: true });
});
app.post("/api/bot/stop", async (req, res) => {
  await bot.stop();
  res.json({ ok: true });
});

// ==================== Start ====================
app.listen(3333, () => console.log("✅ Painel: http://localhost:3001"));
