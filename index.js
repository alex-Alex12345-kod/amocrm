const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

// Отдаём статические файлы из папки widget
app.use("/widget", express.static(path.join(__dirname, "widget")));

// Проверка
app.get("/", (req, res) => {
  res.send("✅ Сервер AmoCRM-виджета работает!");
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
