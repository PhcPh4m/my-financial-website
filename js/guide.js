// Trang Hướng dẫn: mỗi lần chỉ hiện một mục.
// Bấm tên mục trong mục lục hoặc liên kết trong bài để đổi mục. Mục cũ mờ đi, mục mới trượt vào theo chiều chuyển.
(function () {
    const sections = Array.from(document.querySelectorAll('.guide-section'));
    if (!sections.length) return;
    const toc = document.querySelector('.guide-toc');
    const pill = document.querySelector('.guide-toc__pill');
    const links = Array.from(document.querySelectorAll('.guide-toc a'));
    const tocToggle = document.querySelector('.guide-toc__toggle');
    const tocNarrow = window.matchMedia('(max-width: 860px)');

    // Trên điện thoại: nút hiện tên mục đang đọc, bấm để mở hoặc thu danh sách.
    function syncToggle(i) {
        if (!tocToggle) return;
        const h = sections[i] && sections[i].querySelector('h2');
        const label = tocToggle.querySelector('.guide-toc__toggle-label');
        if (label && h) label.textContent = h.textContent;
    }

    function setCollapsed(collapsed) {
        if (!toc || !tocToggle) return;
        toc.classList.toggle('is-collapsed', collapsed);
        tocToggle.setAttribute('aria-expanded', String(!collapsed));
        if (current >= 0) markToc(current);
    }

    if (toc && tocToggle && tocNarrow.matches) {
        toc.classList.add('is-collapsed');
        tocToggle.setAttribute('aria-expanded', 'false');
    }
    if (tocToggle) {
        tocToggle.addEventListener('click', () => setCollapsed(!toc.classList.contains('is-collapsed')));
        links.forEach((a) => a.addEventListener('click', () => { if (tocNarrow.matches) setCollapsed(true); }));
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const LEAVE_MS = 180;
    let current = -1;
    let leaveTimer = null;
    let seq = 0;
    let ready = false;

    function indexFromHash() {
        const id = decodeURIComponent(location.hash.slice(1));
        const i = sections.findIndex((s) => s.id === id);
        return i < 0 ? 0 : i;
    }

    function movePill(link) {
        if (!pill || !toc || !link) return;
        pill.style.width = link.offsetWidth + 'px';
        pill.style.height = link.offsetHeight + 'px';
        pill.style.transform = 'translate(' + link.offsetLeft + 'px, ' + link.offsetTop + 'px)';
        pill.style.opacity = '1';
    }

    function markToc(i) {
        const id = sections[i].id;
        syncToggle(i);
        let activeLink = null;
        links.forEach((a) => {
            const match = a.getAttribute('href') === '#' + id;
            a.classList.toggle('is-current', match);
            if (match) { a.setAttribute('aria-current', 'true'); activeLink = a; }
            else a.removeAttribute('aria-current');
        });
        movePill(activeLink);
    }

    // Khung nội dung đổi chiều cao mượt từ mục dài sang mục ngắn (và ngược lại), cùng đường cong với các trang khác.
    function animateHeight(el, from, to) {
        if (reduceMotion || Math.abs(from - to) < 2) return;
        el.style.boxSizing = 'border-box';
        el.style.overflow = 'clip';
        el.style.height = from + 'px';
        void el.offsetHeight;
        el.style.transition = 'height 0.5s cubic-bezier(0.32, 0.72, 0, 1)';
        el.style.height = to + 'px';
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            el.style.transition = '';
            el.style.height = '';
            el.style.overflow = '';
            el.style.boxSizing = '';
            el.removeEventListener('transitionend', finish);
        };
        el.addEventListener('transitionend', finish);
        setTimeout(finish, 650);
    }

    function enter(i, dir) {
        const s = sections[i];
        s.classList.toggle('is-back', dir < 0);
        s.classList.add('is-active');
        s.classList.remove('is-leaving');
    }

    // Chờ cuộn kết thúc (hoặc tối đa 450 ms) để đổi chiều cao khi trang đã ở đúng vị trí.
    function waitScroll() {
        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                window.removeEventListener('scrollend', finish);
                resolve();
            };
            window.addEventListener('scrollend', finish);
            setTimeout(finish, 450);
        });
    }

    function show(i, instant) {
        if (i === current) return;
        const dir = i > current ? 1 : -1;
        const old = current >= 0 ? sections[current] : null;
        const content = document.querySelector('.guide-content');
        const token = ++seq;
        clearTimeout(leaveTimer);
        current = i;
        markToc(i);
        markVisited(i);
        sections.forEach((s) => { if (s !== old) s.classList.remove('is-active', 'is-leaving'); });

        const animate = old && ready && !instant && !reduceMotion;
        // Nếu người đọc đang cuộn xuống dưới, đưa khung về đầu trước. Khi khung ngắn lại, trình duyệt sẽ kéo trang lên và gây nháy.
        let scrolling = null;
        if (animate && content) {
            const target = content.getBoundingClientRect().top + window.scrollY - 16;
            if (window.scrollY > target + 4) {
                window.scrollTo({ top: target, behavior: 'smooth' });
                scrolling = waitScroll();
            }
        }

        const swap = () => {
            if (token !== seq) return;
            const from = content ? content.getBoundingClientRect().height : 0;
            old.classList.remove('is-active', 'is-leaving');
            enter(i, dir);
            if (content) {
                content.style.height = 'auto';
                const to = content.getBoundingClientRect().height;
                content.style.height = '';
                animateHeight(content, from, to);
            }
        };

        // Mục cũ mờ đi ngay. Chỉ đổi chiều cao khi vừa hết mờ vừa cuộn xong, nên không còn khoảng đứng yên.
        const leave = () => {
            if (token !== seq) return;
            if (animate) {
                old.classList.add('is-leaving');
                const fade = new Promise((resolve) => { leaveTimer = setTimeout(resolve, LEAVE_MS); });
                Promise.all([fade, scrolling || Promise.resolve()]).then(() => {
                    if (token === seq) swap();
                });
            } else {
                if (old) old.classList.remove('is-active', 'is-leaving');
                enter(i, dir);
            }
        };

        leave();
    }

    // ===== Thanh tiến trình cho người dùng mới =====
    // Chỉ chạy khi chưa có guide_ack_v1. Mỗi mục được mở ít nhất một lần thì tính là đã đọc.
    // Tiến độ lưu trong sessionStorage, nên tải lại trang trong cùng tab không mất tiến độ.
    const progressEl = document.getElementById('guideProgress');
    const progressFill = document.getElementById('guideProgressFill');
    const progressLabel = document.getElementById('guideProgressLabel');
    const progressTrack = progressEl && progressEl.querySelector('.guide-progress__track');
    const PROGRESS_KEY = 'guide_progress_v1';
    const PAGE_LEAVE_MS = 340;
    const trackProgress = !!progressEl && !(() => { try { return localStorage.getItem('guide_ack_v1'); } catch (e) { return null; } })();
    const visited = new Set();
    let finished = false;

    if (trackProgress) {
        try { JSON.parse(sessionStorage.getItem(PROGRESS_KEY) || '[]').forEach((id) => visited.add(id)); } catch (e) {}
        progressEl.hidden = false;
        if (new URLSearchParams(location.search).get('required') === '1') {
            document.getElementById('guideProgressHint').hidden = false;
        }
    }

    function renderProgress() {
        const total = sections.length;
        const pct = Math.round((visited.size / total) * 100);
        progressFill.style.width = pct + '%';
        progressTrack.setAttribute('aria-valuenow', String(pct));
        progressLabel.textContent = visited.size === total ? 'Đã đọc hết hướng dẫn' : 'Đã đọc ' + visited.size + '/' + total + ' mục';
    }

    // Hoàn tất: ghi xác nhận, thanh đã đầy nên dừng một nhịp, rồi chuyển sang trang Giao dịch.
    function finishGuide() {
        if (finished) return;
        finished = true;
        progressEl.classList.add('is-complete');
        progressLabel.textContent = 'Đã đọc hết hướng dẫn. Đang mở app…';
        try { localStorage.setItem('guide_ack_v1', '1'); } catch (e) {}
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        setTimeout(() => {
            document.body.classList.remove('page-enter');
            document.body.classList.add('page-leave');
            setTimeout(() => location.assign('index.html'), reduceMotion ? 0 : PAGE_LEAVE_MS);
        }, reduceMotion ? 0 : 900);
    }

    function markVisited(i) {
        if (!trackProgress || finished) return;
        const id = sections[i].id;
        if (visited.has(id)) return;
        visited.add(id);
        try { sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(Array.from(visited))); } catch (e) {}
        renderProgress();
        if (visited.size === sections.length) finishGuide();
    }

    if (trackProgress) renderProgress();

    window.addEventListener('hashchange', () => show(indexFromHash(), false));
    window.addEventListener('resize', () => markToc(current));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => markToc(current));
    show(indexFromHash(), true);
    ready = true;
})();
