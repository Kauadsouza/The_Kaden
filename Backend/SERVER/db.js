// Backend/SERVER/db.js
"use strict";

const { Pool } = require("pg");
require("dotenv").config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ Falta DATABASE_URL no .env / env vars");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase precisa SSL
});

// ✅ Compat com seu server.js: const [rows] = await db.query(...)
module.exports = {
  query: async (text, params) => {
    const r = await pool.query(text, params);
    return [r.rows];
  },
};
