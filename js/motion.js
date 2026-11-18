// GIẢM CHUYỂN ĐỘNG: đọc tùy chọn đã lưu và đặt html[data-reduce-motion] sớm, trước khi trang vẽ.
// Nếu người dùng chưa bật thì không có gì thay đổi (mặc định giữ animation).
(function () {
    try {
        const s = JSON.parse(localStorage.getItem('app_settings') || '{}');
        if (s && s.reduceMotion === true) {
            document.documentElement.dataset.reduceMotion = 'on';
        }
    } catch (e) {
        // Bộ nhớ bị chặn: giữ mặc định.
    }
})();
