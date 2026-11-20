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

// Thời lượng và đường cong lấy từ token CSS (--motion-*), để JS luôn khớp với CSS.
window.motionTokens = {
    ms(name) {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--motion-' + name).trim();
        const n = parseFloat(v) || 0;
        return v.endsWith('ms') ? n : n * 1000;
    },
    ease() {
        return getComputedStyle(document.documentElement).getPropertyValue('--motion-ease').trim();
    },
};

// Đổi nội dung theo đúng nhịp chuyển trang lớn: phần cũ đi (page-out, --motion-mid), rồi phần mới vào (entry-in, --motion-base).
// outgoing: các phần tử sắp ẩn. apply: hàm đổi trạng thái. enter: thẻ cần chạy lại chuyển động vào (class card-replay).
// Chỉ một lần đổi chạy tại một thời điểm; bấm lần thứ hai trong lúc đang đổi thì bỏ qua.
(function () {
    let busy = false;
    const reduced = () => document.documentElement.dataset.reduceMotion === 'on'
        || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    window.swapBusy = () => busy;

    window.swapBlock = function (outgoing, apply, enter) {
        if (busy) return;
        const leaving = (outgoing || []).filter((el) => el && !el.hidden);
        if (reduced() || !leaving.length) { apply(); return; }
        busy = true;
        leaving.forEach((el) => el.classList.add('swap-leave'));
        setTimeout(() => {
            leaving.forEach((el) => el.classList.remove('swap-leave'));
            apply();
            (enter || []).forEach((el) => {
                if (!el) return;
                el.classList.remove('card-replay');
                void el.offsetWidth;
                el.classList.add('card-replay');
            });
            busy = false;
        }, motionTokens.ms('mid'));
    };
})();
