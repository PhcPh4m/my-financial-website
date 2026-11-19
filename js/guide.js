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
    const LEAVE_MS = 300;
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
        el.style.overflow = 'hidden';
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

    function show(i, instant) {
        if (i === current) return;
        const dir = i > current ? 1 : -1;
        const old = current >= 0 ? sections[current] : null;
        const content = document.querySelector('.guide-content');
        const token = ++seq;
        clearTimeout(leaveTimer);
        current = i;
        markToc(i);
        sections.forEach((s) => { if (s !== old) s.classList.remove('is-active', 'is-leaving'); });

        const animate = old && ready && !instant && !reduceMotion;
        // Nếu người đọc đang cuộn xuống dưới, đưa khung về đầu trước. Khi khung ngắn lại, trình duyệt sẽ kéo trang lên và gây nháy.
        let lead = 0;
        if (animate && content) {
            const target = content.getBoundingClientRect().top + window.scrollY - 16;
            if (window.scrollY > target + 4) {
                window.scrollTo({ top: target, behavior: 'smooth' });
                lead = 320;
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

        const leave = () => {
            if (token !== seq) return;
            if (animate) {
                old.classList.add('is-leaving');
                leaveTimer = setTimeout(swap, LEAVE_MS);
            } else {
                if (old) old.classList.remove('is-active', 'is-leaving');
                enter(i, dir);
            }
        };

        if (lead) leaveTimer = setTimeout(leave, lead);
        else leave();
    }

    window.addEventListener('hashchange', () => show(indexFromHash(), false));
    window.addEventListener('resize', () => markToc(current));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => markToc(current));
    show(indexFromHash(), true);
    ready = true;
})();
