const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("✅ Сервер AmoCRM работает!");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});

// index.js
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const MS_API_BASE = process.env.MS_API_BASE;      // https://ms.example/api
const MS_API_KEY  = process.env.MS_API_KEY;       // ключ МС
const CRM_API_BASE = process.env.CRM_API_BASE;    // https://your-amocrm
const CRM_API_KEY  = process.env.CRM_API_KEY;     // ключ CRM
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET; // секрет для проверки от amoCRM

function log(s) {
  console.log(s);
  try { fs.appendFileSync('./sync.log', new Date().toISOString() + ' ' + s + '\n'); } catch(e){}
}

async function fetchShipmentFromMS(orderId) {
  const url = `${MS_API_BASE}/shipment/${encodeURIComponent(orderId)}`;
  const res = await axios.get(url, { headers: { 'Authorization': `Bearer ${MS_API_KEY}` }, timeout: 10000 });
  return res.data; // предполагаем { shipmentId, items: [{ sku, cost, qty }, ...] }
}

async function updateOrderCostsInCRM(orderId, itemsForCRM) {
  const url = `${CRM_API_BASE}/orders/${encodeURIComponent(orderId)}/edit`;
  const body = { order: { id: orderId, items: itemsForCRM } };
  await axios.post(url, body, { headers: { 'X-API-KEY': CRM_API_KEY }, timeout: 10000 });
}

app.post('/webhook/update-cost', async (req, res) => {
  try {
    // Простая проверка секрета (amoCRM можно настроить посылать заголовок X-Hub-Signature или X-Webhook-Secret)
    const incomingSecret = req.headers['x-webhook-secret'] || req.headers['x-secret'];
    if (WEBHOOK_SECRET && incomingSecret !== WEBHOOK_SECRET) {
      log('Webhook secret mismatch');
      return res.status(403).send('forbidden');
    }

    // Поищи где в payload order id — адаптируй в зависимости от твоего amoCRM
    const payload = req.body;
    const orderId = payload?.order?.id || payload?.data?.orderId || payload?.lead?.id;
    if (!orderId) {
      log('No orderId in webhook payload: ' + JSON.stringify(payload).slice(0,300));
      return res.status(400).send('no order id');
    }

    // Проверка идемпотентности: лучше заранее создать кастомное поле в CRM cost_synced
    // Здесь – пример простого запроса: (опция: пропусти, если не нужно)
    // Если уже синкали — выход
    // ... (реализация зависит от API CRM) ...

    // Берём отгрузку в МС
    const shipment = await fetchShipmentFromMS(orderId);
    if (!shipment || !Array.isArray(shipment.items) || shipment.items.length === 0) {
      log(`Shipment empty for order ${orderId}`);
      return res.status(500).send('shipment empty');
    }

    const crmItems = shipment.items.map(it => ({
      offer: { externalId: it.sku || it.article || it.externalId },
      purchasePrice: it.cost
    }));

    await updateOrderCostsInCRM(orderId, crmItems);

    // Пометка в CRM: cost_synced = true (опционально)
    // await markCostSyncedInCRM(orderId, shipment.shipmentId);

    log(`Order ${orderId} costs updated`);
    return res.status(200).send('ok');

  } catch (err) {
    log('Error processing webhook: ' + (err.message || err));
    return res.status(500).send('error');
  }
});

app.get('/', (req, res) => res.send('Hello from amocrm sync!'));

app.listen(PORT, () => {
  log(`Server listening on port ${PORT}`);
});
