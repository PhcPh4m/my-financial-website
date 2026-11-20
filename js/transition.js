// Chuyển trang trong cùng một tab: thanh kính ở menu trượt tới tab mới, trang cũ mờ dần, rồi mới mở trang mới.
// Không mở tab mới. Ctrl/Cmd/Shift-click vẫn để trình duyệt xử lý vì đó là thao tác chủ động của người dùng.

function currentNavLink() {
    return document.querySelector('.nav-link[aria-current="page"]');
}

// Đặt thanh kính đúng dưới tab được chọn. animate=false khi tải trang để không chạy lại hiệu ứng.
function moveNavPill(link, animate = true) {
    const pill = document.querySelector('.nav-tabs__pill');
    if (!pill || !link) return;
    if (!animate) pill.style.transition = 'none';
    pill.style.width = `${link.offsetWidth}px`;
    pill.style.transform = `translateX(${link.offsetLeft}px)`;
    pill.style.opacity = '1';
    if (!animate) {
        void pill.offsetWidth; // ép trình duyệt áp dụng vị trí ngay, rồi mới bật lại transition
        pill.style.transition = '';
    }
}

function initNavPill() {
    moveNavPill(currentNavLink(), false);
    window.addEventListener('resize', () => moveNavPill(currentNavLink(), false));
}

// Tải trước trang đích khi rê chuột hoặc focus vào tab, để lúc bấm trang mở gần như ngay.
const prefetched = new Set();
function prefetchPage(href) {
    if (!href || prefetched.has(href)) return;
    prefetched.add(href);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
}

function initPageTransitions() {
    const body = document.body;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.addEventListener('click', (e) => {
        const link = e.target.closest('a.nav-link');
        if (!link || e.defaultPrevented || e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (link.target && link.target !== '_self') return;
        if (link.getAttribute('aria-current') === 'page') return;

        const href = link.getAttribute('href');
        if (!href) return;

        e.preventDefault();
        moveNavPill(link, !reduceMotion);
        if (reduceMotion) {
            window.location.assign(href);
            return;
        }
        body.classList.remove('page-enter');
        body.classList.add('page-leave');
        setTimeout(() => window.location.assign(href), motionTokens.ms('mid')); // đủ thời gian để thanh kính trượt xong trước khi đổi trang
    });

    // Bấm Quay lại: trình duyệt có thể khôi phục trang đã rời đi với class cũ, nên xóa đi.
    window.addEventListener('pageshow', () => body.classList.remove('page-leave'));

    document.addEventListener('pointerover', (e) => {
        const link = e.target.closest && e.target.closest('a.nav-link');
        if (link) prefetchPage(link.getAttribute('href'));
    });
    document.addEventListener('focusin', (e) => {
        const link = e.target.closest && e.target.closest('a.nav-link');
        if (link) prefetchPage(link.getAttribute('href'));
    });

    initNavPill();
    // Font và icon có thể đổi độ rộng tab sau khi tải; đo lại khi đã sẵn sàng.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => moveNavPill(currentNavLink(), false));
    window.addEventListener('load', () => moveNavPill(currentNavLink(), false));
}

initPageTransitions();

// Thanh kính bám theo tab trong lúc nhãn đang mở rộng hoặc thu gọn (không đổi hiệu ứng chuyển trang).
function followNavPill(ms = motionTokens.ms('slow')) {
    const end = performance.now() + ms;
    const step = () => {
        moveNavPill(currentNavLink(), false);
        if (performance.now() < end) requestAnimationFrame(step);
    };
    step();
}
