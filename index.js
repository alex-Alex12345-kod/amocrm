// index.js
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("✅ Сервер AmoCRM-виджета работает!");
});

// сюда потом можно добавить логику (например, получение данных из API)
app.get("/widget", (req, res) => {
  res.json({ message: "Данные для виджета AmoCRM" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
