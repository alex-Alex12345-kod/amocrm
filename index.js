const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Отдаём статические файлы из папки widget
app.use("/widget", express.static("widget"));

// Главная страница
app.get("/", (req, res) => {
  res.send("✅ AmoCRM Widget Server работает!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
