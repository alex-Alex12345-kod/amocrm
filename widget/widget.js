define([], function() {
  return {
    render: function() {
      this.$el.html(`
        <div style="padding:10px;">
          <h3 style="margin:0 0 8px;color:#0b74de">Clean Clinic — тест</h3>
          <button id="cc-test-btn" style="padding:6px 10px;background:#0b74de;color:#fff;border:none;border-radius:4px;cursor:pointer">
            Нажми меня
          </button>
          <div id="cc-result" style="margin-top:10px;"></div>
        </div>
      `);

      const self = this;
      this.$el.find('#cc-test-btn').on('click', function() {
        self.$el.find('#cc-result').text('Кнопка работает! ' + new Date().toLocaleTimeString());
      });

      console.log("✅ Clean Clinic widget загружен");
      return true;
    }
  };
});
