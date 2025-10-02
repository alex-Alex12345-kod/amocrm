define([], function () {
    return {
        init: function () {
            console.log("Clean Clinic – виджет инициализирован");
            return true;
        },

        render: function () {
            console.log("Clean Clinic – рендер, зона:", this.system().area);

            // Общий HTML для кнопки
            const html = `
                <div style="padding:15px; font-family:Arial, sans-serif;">
                    <h3>Clean Clinic</h3>
                    <button id="ccw-btn" 
                        style="padding:8px 14px; background:#1890ff; color:#fff; border:none; border-radius:6px; cursor:pointer;">
                        Нажми кнопку
                    </button>
                    <div id="ccw-result" style="margin-top:10px; font-weight:bold; color:#333;"></div>
                </div>
            `;

            // Вставляем в зону (и таб, и боковую панель)
            this.$el.html(html);

            // Универсальный обработчик
            this.$el.find('#ccw-btn').on('click', () => {
                const msg = `Кнопка нажата (${this.system().area})`;
                this.$el.find('#ccw-result').text(msg);
                console.log("Clean Clinic:", msg);
            });

            return true;
        },

        settings: function () {
            console.log("Clean Clinic – настройки открыты");
            return true;
        },

        destroy: function () {
            console.log("Clean Clinic – выгружен");
            return true;
        }
    };
});
