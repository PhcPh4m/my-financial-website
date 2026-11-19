// Số tiền lớn nhất được phép nhập: một nghìn tỷ đồng.
const MAX_AMOUNT = 1_000_000_000_000; // 1 nghìn tỷ VND – giới hạn hợp lý cho một giao dịch
// Tên giao dịch tối đa 100 ký tự.
const MAX_TITLE_LENGTH = 100;

// Shortcut for document.getElementById
const $ = (id) => document.getElementById(id);

// FORMATTING

// Đổi số thành dạng tiền dễ đọc: 1234567 thành 1.234.567 đ.
// SỐ TIỀN: ô nhập là ô số thuần, nên không bị bộ gõ tiếng Việt can thiệp.
// Dòng xem trước ngay bên dưới hiển thị số có dấu chấm, ví dụ 5.000.000 đ.
function groupDigits(digits) {
    return String(digits).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Đọc số tiền từ ô. Ô trống trả về null.
function parseMoney(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits === '' ? null : Number(digits);
}

// Dòng xem trước: lấy phần tử ngay sau ô, tạo mới nếu chưa có.
function moneyPreviewFor(el) {
    let preview = el.nextElementSibling;
    if (!preview || !preview.classList.contains('money-preview')) {
        preview = document.createElement('small');
        preview.className = 'money-preview';
        preview.setAttribute('aria-live', 'polite');
        el.insertAdjacentElement('afterend', preview);
    }
    return preview;
}

function updateMoneyPreview(el) {
    const n = parseMoney(el.value);
    moneyPreviewFor(el).textContent = n === null ? '' : `${groupDigits(n)} đ`;
}

// Ghi số tiền vào ô (số thuần), rồi cập nhật dòng xem trước.
function setMoneyValue(el, amount) {
    el.value = amount === null || amount === undefined || amount === '' ? '' : String(Math.round(Number(amount)));
    updateMoneyPreview(el);
}

function isMoneyInput(el) {
    return !!(el && el.dataset && el.dataset.money !== undefined);
}

// Chỉ cho gõ chữ số: chặn dấu âm, dấu thập phân và chữ e.
document.addEventListener('keydown', (e) => {
    if (!isMoneyInput(e.target)) return;
    if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) e.preventDefault();
});

document.addEventListener('input', (e) => {
    if (isMoneyInput(e.target)) updateMoneyPreview(e.target);
});

function formatCurrency(amount) {
    const n = Math.round(Number(amount) || 0);
    return `${new Intl.NumberFormat('vi-VN').format(n)} đ`;
}

// Đổi ngày 2026-10-14 thành 14/10/2026.
function formatDate(isoDate) {
    if (!isValidISODate(isoDate)) return isoDate || '';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
}

// Rút gọn số tiền cho trục biểu đồ, ví dụ 4500000 thành 4,5 Tr.
function formatCompactVND(amount, full = false) {
    if (full) return formatCurrency(amount);
    const n = Number(amount) || 0;
    if (Math.abs(n) >= 1_000_000) {
        return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(n / 1_000_000)} Tr`;
    }
    if (Math.abs(n) >= 1_000) {
        return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n / 1_000)} K`;
    }
    return new Intl.NumberFormat('vi-VN').format(n);
}

// Đổi 2026-10 thành "Tháng 10/2026".
function formatMonth(monthKey) {
    if (!/^\d{4}-\d{2}$/.test(monthKey || '')) return 'Tất cả thời gian';
    const [y, m] = monthKey.split('-');
    return `Tháng ${Number(m)}/${y}`;
}

// Đổi số phần trăm thành dạng có dấu: 12.5 thành +12,5%. Số 0 không có dấu.
function formatSignedPercent(value) {
    const rounded = Math.round((Number(value) || 0) * 10) / 10;
    const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
    return `${sign}${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(Math.abs(rounded))}%`;
}

// Lùi hoặc tiến số tháng: 2026-01 lùi 1 tháng thành 2025-12.
function shiftMonth(monthKey, delta) {
    const [y, m] = monthKey.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Chạy fn khi trang đã tải xong. Các trang khởi tạo qua hàm này.
function onAppReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
}

// Đổi các ký tự đặc biệt (như dấu <) thành dạng an toàn, để người dùng không chèn được mã độc vào trang.
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// DATES

// Lấy ngày hôm nay dạng 2026-10-14.
function toISODate(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Lấy tháng hiện tại dạng 2026-10.
function getCurrentMonth() {
    return toISODate().slice(0, 7);
}

// Kiểm tra ngày có thật không. Ví dụ ngày 30 tháng 2 là không hợp lệ.
function isValidISODate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

// VALIDATION

// Kiểm tra giao dịch trước khi lưu: tên, số tiền, loại, danh mục, trạng thái, ngày. Trả về danh sách lỗi nếu có.
function validateTransaction(tx) {
    const errors = {};
    const title = String(tx.title ?? '').trim();
    const amount = Number(tx.amount);

    if (!title) errors.title = 'Vui lòng nhập tên giao dịch.';
    else if (title.length > MAX_TITLE_LENGTH) errors.title = `Tối đa ${MAX_TITLE_LENGTH} ký tự.`;

    if (tx.amount === '' || tx.amount === null || tx.amount === undefined || Number.isNaN(amount)) {
        errors.amount = 'Vui lòng nhập số tiền.';
    } else if (amount <= 0) {
        errors.amount = 'Số tiền phải lớn hơn 0.';
    } else if (!Number.isInteger(amount)) {
        errors.amount = 'VND không có số lẻ. Vui lòng nhập số nguyên.';
    } else if (amount > MAX_AMOUNT) {
        errors.amount = 'Số tiền quá lớn.';
    }

    if (!['income', 'expense'].includes(tx.type)) errors.type = 'Vui lòng chọn loại giao dịch.';
    if (!String(tx.category ?? '').trim()) errors.category = 'Vui lòng chọn danh mục.';
    if (!['completed', 'pending'].includes(tx.status)) errors.status = 'Vui lòng chọn trạng thái.';
    if (!isValidISODate(tx.date)) errors.date = 'Ngày không hợp lệ.';

    return { isValid: Object.keys(errors).length === 0, errors };
}

// Kiểm tra số ngân sách: phải là số nguyên dương và không quá lớn.
function validateBudget(value) {
    const amount = Number(value);
    if (value === '' || Number.isNaN(amount)) return { isValid: false, error: 'Vui lòng nhập ngân sách.' };
    if (amount <= 0) return { isValid: false, error: 'Ngân sách phải lớn hơn 0.' };
    if (amount > MAX_AMOUNT) return { isValid: false, error: 'Ngân sách quá lớn.' };
    return { isValid: true };
}

// BADGES (ô số liệu)

// Tính phần trăm thay đổi so với kỳ trước. Trả về null khi kỳ trước bằng 0, vì không so sánh được.
function percentChange(current, previous) {
    if (!previous) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
}

// Đổi phần trăm thay đổi thành nội dung badge kèm mũi tên và màu.
// goodWhenUp: tăng là tốt (thu nhập) hay tăng là xấu (chi tiêu).
function trendInfo(change, goodWhenUp = true) {
    if (change === null || !Number.isFinite(change)) return null;
    const rounded = Math.round(change * 10) / 10;
    if (rounded === 0) return { text: formatSignedPercent(0), trend: 'flat', tone: 'neutral' };
    const trend = rounded > 0 ? 'up' : 'down';
    const tone = (trend === 'up') === goodWhenUp ? 'good' : 'bad';
    return { text: formatSignedPercent(rounded), trend, tone };
}

// Tỷ lệ tiết kiệm của một kỳ: chênh lệch chia cho thu nhập. Không có thu nhập thì không tính.
function savingsInfo(summary) {
    if (!summary || summary.income <= 0) return null;
    const rate = Math.round((summary.balance / summary.income) * 100);
    if (rate >= 0) return { text: `Tiết kiệm ${rate}%`, trend: 'flat', tone: 'good' };
    return { text: `Chi vượt thu ${Math.abs(rate)}%`, trend: 'flat', tone: 'bad' };
}

// Đặt nội dung và màu cho badge. Truyền null thì ẩn badge.
function setBadge(el, info) {
    if (!el) return;
    if (!info) {
        el.hidden = true;
        el.textContent = '';
        return;
    }
    el.hidden = false;
    el.textContent = info.text;
    el.dataset.trend = info.trend || 'flat';
    el.dataset.tone = info.tone || 'neutral';
}

// TOAST NOTIFICATIONS

// Hiện thông báo nhỏ ở góc màn hình, rồi tự tắt sau vài giây.
// action (tùy chọn) = { label, onClick }: thêm một nút như "Hoàn tác" vào thông báo.
function showToast(message, type = 'success', duration = 3000, action = null) {
    const container = $('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'status');
    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);

    if (action) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'toast__action';
        btn.textContent = action.label;
        btn.addEventListener('click', () => {
            action.onClick();
            toast.remove();
        });
        toast.appendChild(btn);
    }
    container.appendChild(toast);

    setTimeout(() => toast.remove(), duration);
}

// MODALS

// Mở hộp thoại (cửa sổ nổi) theo tên của nó.
function openModal(id) {
    const modal = $(id);
    if (!modal) return;
    modal.classList.remove('is-closing');
    modal.classList.add('active');
    const focusTarget = modal.querySelector('input, button');
    if (focusTarget) focusTarget.focus();
}

// Đóng hộp thoại.
// Chạy hiệu ứng đóng trước, rồi mới ẩn. Giảm chuyển động thì ẩn ngay.
function hideModal(modal) {
    if (!modal.classList.contains('active')) return;
    const reduced = document.documentElement.dataset.reduceMotion === 'on'
        || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    modal.classList.remove('active');
    if (reduced) {
        modal.classList.remove('is-closing');
        return;
    }
    modal.classList.add('is-closing');
    clearTimeout(modal._closeTimer);
    modal._closeTimer = setTimeout(() => modal.classList.remove('is-closing'), 460);
}

function closeModal(id) {
    const modal = $(id);
    if (modal) hideModal(modal);
}

// Đóng hộp thoại và đưa con trỏ về chỗ cũ.
function dismissModal(modal) {
    if (modal.id === 'confirmModal') {
        $('confirmCancel').click();
    } else {
        hideModal(modal);
    }
}

// Cho phép đóng hộp thoại bằng phím Esc hoặc bấm ra ngoài.
function bindModalDismissal() {
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        document.querySelectorAll('.modal.active').forEach(dismissModal);
    });
    document.querySelectorAll('.modal').forEach((modal) => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) dismissModal(modal);
        });
    });
}

// Hiện hộp hỏi "Bạn có chắc không?". Trả về có hoặc không tùy lựa chọn.
function confirmDialog(title, message, confirmText = 'Xác nhận') {
    return new Promise((resolve) => {
        $('confirmTitle').textContent = title;
        $('confirmMessage').textContent = message;
        const okBtn = $('confirmOk');
        const cancelBtn = $('confirmCancel');
        okBtn.textContent = confirmText;

        const finish = (result) => {
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            closeModal('confirmModal');
            resolve(result);
        };

        okBtn.onclick = () => finish(true);
        cancelBtn.onclick = () => finish(false);
        openModal('confirmModal');
    });
}

// FILE DOWNLOAD

// Tải một file về máy từ nội dung đã có.
function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// THEME (sáng / tối)

// Tên ngăn nhớ lưu chế độ sáng hoặc tối.
const THEME_KEY = 'app_theme';

// Hỏi đang ở chế độ nào: sáng hay tối.
function currentTheme() {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

// Đổi giao diện sang sáng hoặc tối và đổi biểu tượng của nút tương ứng.
function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#EEF4F8' : '#0B1A26';

    const btn = $('themeToggle');
    if (btn) {
        const target = theme === 'light' ? 'tối' : 'sáng';
        btn.innerHTML = makeIcon(theme === 'light' ? 'moon' : 'sun');
        btn.setAttribute('aria-label', `Chuyển sang giao diện ${target}`);
        btn.title = `Chuyển sang giao diện ${target}`;
    }
}

// Chạy khi bấm nút đổi giao diện: đổi qua lại sáng và tối, rồi nhớ lựa chọn.
function toggleTheme() {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    try {
        localStorage.setItem(THEME_KEY, next);
    } catch (e) {
        // Bộ nhớ bị chặn hoặc đầy: vẫn đổi giao diện trong phiên này.
    }
    applyTheme(next);
    document.dispatchEvent(new CustomEvent('themechange', { detail: next }));
}

document.addEventListener('DOMContentLoaded', () => {
    applyTheme(currentTheme());
    const btn = $('themeToggle');
    if (btn) btn.addEventListener('click', toggleTheme);
});

// THẺ NGÂN SÁCH DÙNG CHUNG
// Đồng hồ bán nguyệt có vạch chia. Dùng ở Giao dịch và Biểu đồ để hai trang đồng bộ.

// Điểm trên cung tròn: p từ 0 (trái) đến 1 (phải), đi qua đỉnh. r là bán kính.
function gaugePoint(p, r) {
    const theta = Math.PI - p * Math.PI;
    return { x: 100 + r * Math.cos(theta), y: 100 - r * Math.sin(theta) };
}

function budgetCardHTML(status) {
    const alertClass = { ok: 'alert--info', warning: 'alert--warning', danger: 'alert--danger' }[status.level];
    const message = {
        ok: 'Chi tiêu tháng này đang trong ngân sách.',
        warning: 'Bạn đã dùng hơn 80% ngân sách tháng này.',
        danger: 'Bạn đã vượt ngân sách tháng này.'
    }[status.level];

    // 41 vạch chia, vạch lớn mỗi 10%.
    const ticks = Array.from({ length: 41 }, (_, i) => {
        const a = gaugePoint(i / 40, 88);
        const b = gaugePoint(i / 40, 96);
        const cls = i % 10 === 0 ? 'gauge-tick gauge-tick--major' : 'gauge-tick';
        return `<line class="${cls}" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"/>`;
    }).join('');

    const arc = 'M 20 100 A 80 80 0 0 1 180 100';
    const knob = gaugePoint(0, 80);

    return `
        <div class="alert ${alertClass} budget-card" role="status">
            <div class="budget-gauge" data-level="${status.level}"
                 data-pct="${Math.min(status.percent, 100).toFixed(2)}"
                 data-count-to="${Math.round(status.percent)}"
                 data-spent="${Math.round(status.spent)}">
                <svg viewBox="0 0 200 110" aria-hidden="true" focusable="false">
                    ${ticks}
                    <path class="budget-gauge__track" d="${arc}" pathLength="100"/>
                    <path class="budget-gauge__bar" d="${arc}" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>
                    <circle class="budget-gauge__knob" r="6" cx="${knob.x.toFixed(2)}" cy="${knob.y.toFixed(2)}"/>
                </svg>
                <span class="budget-gauge__value"><span data-count="pct">0</span>%</span>
            </div>
            <div class="budget-card__text">
                <strong>${message}</strong>
                <div>Đã chi <span data-count="spent">0 đ</span> / ${formatCurrency(status.budget)}</div>
            </div>
        </div>`;
}

// Chạy hiệu ứng sau khi thẻ được vẽ: kim và cung chạy tới giá trị thật, số đếm lên trong 1 giây.
// Nếu hệ điều hành bật "Giảm chuyển động" thì hiện luôn số đúng.
function animateBudgetGauges(root) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    root.querySelectorAll('.budget-gauge').forEach((g) => {
        const arcTarget = Number(g.dataset.pct);
        const countTo = Number(g.dataset.countTo);
        const spentTo = Number(g.dataset.spent);
        const bar = g.querySelector('.budget-gauge__bar');
        const knob = g.querySelector('.budget-gauge__knob');
        const pctEl = g.querySelector('[data-count="pct"]');
        const spentEl = g.querySelector('[data-count="spent"]');
        const textBox = g.parentElement.querySelector('.budget-card__text');
        const spentText = textBox ? textBox.querySelector('[data-count="spent"]') : spentEl;

        // k từ 0 đến 1: vị trí của kim, phần trăm và số tiền đã chi ở thời điểm đó.
        const draw = (k) => {
            const p = (arcTarget / 100) * k;
            const pt = gaugePoint(p, 80);
            bar.style.strokeDashoffset = String(100 * (1 - p));
            knob.setAttribute('cx', pt.x.toFixed(2));
            knob.setAttribute('cy', pt.y.toFixed(2));
            pctEl.textContent = String(Math.round(countTo * k));
            spentText.textContent = formatCurrency(spentTo * k);
        };

        if (reduce) { draw(1); return; }

        const dur = 1000;
        const start = performance.now();
        const step = (now) => {
            const t = Math.min(1, (now - start) / dur);
            draw(1 - Math.pow(1 - t, 3)); // ease-out
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    });
}

// ĐẾM SỐ LÊN
// Đổi nội dung một ô số từ giá trị đang hiện sang giá trị mới trong khoảng 0.9 giây.
// Lần đầu đếm từ 0. Khi đổi tháng hoặc chọn tất cả thời gian, đếm từ số cũ sang số mới.
// Nếu hệ điều hành bật "Giảm chuyển động" thì hiện luôn số đúng.
function countTo(el, to, format = formatCurrency) {
    if (!el) return;
    const from = Number(el.dataset.num ?? 0);
    el.dataset.num = String(to);
    if (el._countRaf) cancelAnimationFrame(el._countRaf);

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || from === to) {
        el.textContent = format(to);
        return;
    }

    const dur = 900;
    const start = performance.now();
    const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = format(from + (to - from) * eased);
        el._countRaf = t < 1 ? requestAnimationFrame(step) : null;
    };
    el._countRaf = requestAnimationFrame(step);
}

const formatCount = (n) => String(Math.round(n));

