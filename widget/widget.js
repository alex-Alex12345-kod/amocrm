define([], function () {
    var CustomWidget = function () {
        return {
            render: function () {
                console.log('Виджет загружен!');
                return true;
            }
        };
    };
    return CustomWidget;
});
