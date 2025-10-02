define([], function () {
    return {
        init: function () {
            console.log("Clean Clinic – виджет инициализирован");
            return true;
        },

        render: function () {
            console.log("Clean Clinic – рендерим виджет");

            // Вставляем HTML прямо в карточку сделки
            this.$el.html(`
                <div style="padding:10px; border:1px solid #ddd; border-radius:6px; background:#f9f9f9; margin:10px 0;">
                    <h3 style="margin:0 0 10px;">Clean Clinic Виджет</h3>
                    <button id="ccw-btn" 
                        style="padding:8px 12px; background:#ff4d4f; color:#fff; border:none; border-radius:4px; cursor:pointer;">
                        Нажми меня
                    </button>
                    <div id="ccw-result" style="margin-top:10px; color:#333;"></div>
                </div>
            `);

            // Логика кнопки
            this.$el.find('#ccw-btn').on('click', () => {
                this.$el.find('#ccw-result').text("Кнопка работает! " + new Date().toLocaleTimeString());
                console.log("Clean Clinic – кнопка нажата");
            });

            return true;
        },

        settings: function () {
            console.log("Clean Clinic – настройки открыты");
            return true;
        },

        destroy: function () {
            console.log("Clean Clinic – виджет выгружен");
            return true;
        }
    };
});
