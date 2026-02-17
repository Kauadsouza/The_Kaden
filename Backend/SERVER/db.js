"use strict";

require("dotenv").config();
const { Pool } = require("pg");

const DATABASE_URL = (process.env.DATABASE_URL || "").trim();
if (!DATABASE_URL) {
  console.error("❌ Falta DATABASE_URL no .env");
  process.exit(1);
}

// Supabase normalmente precisa SSL
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
});

pool.on("error", (err) => {
  console.error("❌ PG POOL ERROR:", err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
