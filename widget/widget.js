define([], function () {
    return {
        init: function () {
            console.log("✅ Clean Clinic: init вызван");
            return true;
        },

        render: function () {
            console.log("✅ Clean Clinic: render вызван");

            this.$el.html(`
                <div style="padding:10px;">
                    <h3 style="margin-bottom:10px;">Clean Clinic – тестовый виджет</h3>
                    <button id="clean-btn" 
                            style="padding:8px 12px; background:#4CAF50; color:#fff; border:none; border-radius:4px; cursor:pointer;">
                        Нажми меня
                    </button>
                    <div id="clean-result" style="margin-top:10px; font-size:14px; color:#333;"></div>
                </div>
            `);

            let self = this;
            this.$el.find("#clean-btn").on("click", function () {
                self.$el.find("#clean-result").text("Кнопка сработала! Время: " + new Date().toLocaleTimeString());
            });

            return true;
        },

        settings: function () {
            console.log("✅ Clean Clinic: settings вызван");
            return true;
        },

        dpSettings: function () {
            return true;
        },

        destroy: function () {
            console.log("❌ Clean Clinic: виджет выгружен");
            return true;
        }
    };
});
