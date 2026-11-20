// ANIMATION MỞ/ĐÓNG cho khối <details data-animate>: trượt và mờ dần, số tiền đếm lên mỗi lần mở.
// Tắt hiệu ứng nếu bật "giảm chuyển động".
(function () {
    const reduced = () => document.documentElement.dataset.reduceMotion === 'on'
        || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    // Đọc "30.800.000 đ" hoặc "−250.000 đ" thành số. Trả về null nếu không đúng dạng.
    function parseMoney(text) {
        const m = String(text).trim().match(/^([−-]?)\s*([\d.]+)\s*đ$/);
        if (!m) return null;
        const n = Number(m[2].replace(/\./g, ''));
        return m[1] ? -n : n;
    }
    function fmtMoney(n) {
        return (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('vi-VN') + ' đ';
    }

    // Đếm từ 0 lên giá trị thật. Giá trị cuối được lưu để lần mở sau vẫn đúng dù đang đếm dở.
    function countUp(root, duration) {
        if (reduced()) return;
        root.querySelectorAll('.kpi__value').forEach((el) => {
            const finalText = el.dataset.counting ? el.dataset.final : el.textContent;
            const target = parseMoney(finalText);
            if (target === null) return;
            el.dataset.final = finalText;
            el.dataset.counting = '1';
            const t0 = performance.now();
            const step = (now) => {
                const p = Math.min(1, (now - t0) / duration);
                const eased = 1 - Math.pow(1 - p, 3);
                el.textContent = fmtMoney(target * eased);
                if (p < 1) {
                    requestAnimationFrame(step);
                } else {
                    el.textContent = finalText;
                    delete el.dataset.counting;
                }
            };
            requestAnimationFrame(step);
        });
    }

    // Thẻ luôn giữ thuộc tính open để trình duyệt không tự ẩn/hiện nội dung (nguyên nhân khiến khối bung ngay).
    // Trạng thái đóng/mở do class is-open và chiều cao inline quản lý, nên mọi chuyển động đều chạy qua animation.
    function bind(details) {
        const summary = details.querySelector('summary');
        const body = details.querySelector(':scope > :not(summary)');
        if (!summary || !body) return;
        // Padding lúc nghỉ, đọc từ CSS trước khi có style inline.
        const rest = getComputedStyle(body);
        const restPt = parseFloat(rest.paddingTop) || 0;
        const restPb = parseFloat(rest.paddingBottom) || 0;
        let anim = null;
        let isOpen = details.classList.contains('is-open');

        function applyFinal(open) {
            const st = body.style;
            if (open) {
                st.height = ''; st.paddingTop = ''; st.paddingBottom = '';
                st.overflow = ''; st.boxSizing = ''; st.visibility = ''; st.opacity = '';
            } else {
                st.boxSizing = 'border-box'; st.height = '0px';
                st.paddingTop = '0px'; st.paddingBottom = '0px';
                st.overflow = 'hidden'; st.visibility = 'hidden'; st.opacity = '0';
            }
            details.open = true;
            details.classList.toggle('is-open', open);
            summary.setAttribute('aria-expanded', String(open));
            body.inert = !open;
        }

        applyFinal(isOpen);

        summary.addEventListener('click', (e) => {
            e.preventDefault();
            const opening = !isOpen;
            isOpen = opening;

            if (reduced()) {
                if (anim) anim.cancel();
                anim = null;
                applyFinal(opening);
                if (opening) countUp(body, motionTokens.ms('slow'));
                return;
            }

            // Đọc trạng thái đang hiện (kể cả khi đang chạy dở) để bấm lại không bị nhảy.
            const fromH = body.getBoundingClientRect().height;
            const live = getComputedStyle(body);
            const fromPt = live.paddingTop;
            const fromPb = live.paddingBottom;
            if (anim) anim.cancel();
            anim = null;

            // Đo chiều cao nội dung thật: tạm bỏ padding và chiều cao inline để scrollHeight là nội dung.
            body.style.boxSizing = 'border-box';
            body.style.overflow = 'hidden';
            body.style.height = '0px';
            body.style.paddingTop = '0px';
            body.style.paddingBottom = '0px';
            body.style.visibility = 'visible';
            const contentH = body.scrollHeight;
            body.inert = false;
            details.classList.toggle('is-open', opening);
            summary.setAttribute('aria-expanded', String(opening));

            const toH = opening ? contentH + restPt + restPb : 0;
            const toPt = opening ? restPt + 'px' : '0px';
            const toPb = opening ? restPb + 'px' : '0px';
            const fromVisH = opening && fromH < 1 ? 0 : fromH;

            anim = body.animate([
                { height: fromVisH + 'px', paddingTop: opening && fromH < 1 ? '0px' : fromPt, paddingBottom: opening && fromH < 1 ? '0px' : fromPb, opacity: opening ? 0 : 1, transform: `translateY(${opening ? -6 : 0}px)` },
                { height: toH + 'px', paddingTop: toPt, paddingBottom: toPb, opacity: opening ? 1 : 0, transform: `translateY(${opening ? 0 : -6}px)` }
            ], { duration: motionTokens.ms('base'), easing: motionTokens.ease(), fill: 'forwards' });

            if (opening) countUp(body, motionTokens.ms('slow'));
            const current = anim;
            current.onfinish = () => {
                current.cancel();
                anim = null;
                applyFinal(opening);
            };
        });
    }

    // Gắn cho các khối được vẽ sau này (danh sách khoản trả góp). Mỗi khối chỉ gắn một lần.
    function bindAll(root) {
        root.querySelectorAll('details[data-animate]:not([data-bound])').forEach((d) => { d.dataset.bound = '1'; bind(d); });
    }
    window.bindDetailsAnim = bindAll;
    bindAll(document);
})();
