define([], function () {
    return {
        /**
         * Вызывается при инициализации виджета
         */
        init: function() {
            console.log("✅ Clean Clinic – виджет инициализирован");
            return true;
        },

        /**
         * Отрисовка в карточке сделки
         */
        render: function() {
            this.$el.html(`
                <div style="padding:10px;">
                    <h3 style="margin:0 0 8px;color:#0b74de;">Clean Clinic – тест</h3>
                    <button id="cc-test-btn" style="padding:6px 10px;background:#0b74de;color:#fff;border:none;border-radius:4px;cursor:pointer">
                        Нажми меня
                    </button>
                    <div id="cc-result" style="margin-top:10px;font-size:13px;color:#333;"></div>
                </div>
            `);

            const self = this;
            this.$el.find('#cc-test-btn').on('click', function() {
                self.$el.find('#cc-result').text('Кнопка работает! ' + new Date().toLocaleTimeString());
            });

            console.log("✅ Clean Clinic – виджет отрисован");
            return true;
        },

        /**
         * Открытие настроек виджета
         */
        settings: function() {
            console.log("⚙️ Настройки виджета открыты");
            return true;
        },

        /**
         * Настройки Digital Pipeline (если нужны)
         */
        dpSettings: function() {
            return true;
        },

        /**
         * Уничтожение (например при закрытии карточки)
         */
        destroy: function() {
            console.log("🗑️ Виджет выгружен");
            return true;
        }
    };
});
