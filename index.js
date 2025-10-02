// index.js
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("🚀 Мой первый виджет AmoCRM работает!");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Сервер запущен на порту ${port}`);
});
