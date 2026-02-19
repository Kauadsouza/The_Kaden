"use strict";

const express = require("express");
const router = express.Router();

const mercadopago = require("./mercadopago"); // seu mercadopago.js
const plans = require("./config/plans");

// cria checkout do plano escolhido
router.post("/create-payment", async (req, res) => {
  try {
    const { plan } = req.body || {};
    if (!plan || !plans[plan]) {
      return res.status(400).json({ error: "Plano inválido." });
    }

    const p = plans[plan];

    const preference = await mercadopago.preferences.create({
      items: [
        {
          title: `THE KADEN • ${p.name}`,
          quantity: 1,
          unit_price: p.price,
          currency_id: "BRL",
        },
      ],
      back_urls: {
        success: "http://localhost:3001/app",
        failure: "http://localhost:3001/app",
        pending: "http://localhost:3001/app",
      },
      auto_return: "approved",
    });

    return res.json({ url: preference.body.init_point });
  } catch (e) {
    console.error("MP create-payment error:", e);
    return res.status(500).json({ error: "Erro ao criar pagamento." });
  }
});

module.exports = router;
