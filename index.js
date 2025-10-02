const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

// Корневой маршрут (проверка работы сервера)
app.get("/", (req, res) => {
  res.send("✅ Сервер AmoCRM-виджета работает!");
});

// Новый маршрут для виджета
app.get("/widget", (req, res) => {
  res.sendFile(path.join(__dirname, "widget.html"));
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
