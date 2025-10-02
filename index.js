const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Корневой маршрут (проверка работы сервера)
app.get("/", (req, res) => {
  res.send("✅ Сервер AmoCRM-виджета работает!");
});

// Отдаём всю папку "widget" (manifest.json, widget.js и т.п.)
app.use("/widget", express.static("widget"));

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
