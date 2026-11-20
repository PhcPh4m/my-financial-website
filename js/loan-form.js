// Form thêm khoản trả góp, dùng ở trang Giao dịch. Logic lưu nằm trong loans.js.

function fillInstLenders() {
    const select = $('instLender');
    select.innerHTML = '';
    BANK_RATES.filter((b) => b.type === 'finance').forEach((b) => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        select.appendChild(opt);
    });
    const other = document.createElement('option');
    other.value = 'other';
    other.textContent = 'Khác';
    select.appendChild(other);
    syncInstOther();
}

function syncInstOther() {
    $('instOtherGroup').hidden = $('instLender').value !== 'other';
}

function setInstError(text) {
    $('instError').textContent = text;
}

function addInstLoanFromForm() {
    const lenderId = $('instLender').value;
    const bank = BANK_RATES.find((b) => b.id === lenderId);
    const lenderName = lenderId === 'other' ? $('instOther').value.trim() : (bank ? bank.name : '');
    const principal = parseMoney($('instPrincipal').value);
    const payment = parseMoney($('instPayment').value);
    const months = Number($('instMonths').value);
    const firstDue = $('instFirstDue').value;

    if (!lenderName) return setInstError(lenderId === 'other' ? 'Nhập tên công ty.' : 'Chọn công ty.');
    if (!(principal > 0)) return setInstError('Nhập số tiền vay.');
    if (!(payment > 0)) return setInstError('Nhập số tiền trả mỗi kỳ.');
    if (!(Number.isInteger(months) && months > 0)) return setInstError('Nhập số kỳ là số nguyên dương.');
    if (!firstDue) return setInstError('Chọn ngày kỳ đầu.');
    if (payment * months <= principal) return setInstError('Tổng tiền trả thấp hơn số tiền vay. Kiểm tra lại số kỳ hoặc số tiền mỗi kỳ.');

    if (!addLoan({ lenderId, lenderName, principal, payment, months, firstDue })) {
        return setInstError('Không lưu được khoản vay. Bộ nhớ trình duyệt có thể đã đầy.');
    }
    setInstError('');
    ['instPrincipal', 'instPayment', 'instMonths', 'instFirstDue', 'instOther'].forEach((id) => { $(id).value = ''; });
    renderLoans();
}

// Viên trượt của thanh chuyển hai lựa chọn: trượt đến nút đang chọn, cùng cách làm với thanh tab phía trên.
function moveChoicePill(container, animate = true) {
    const pill = container.querySelector('.seg__pill');
    const active = container.querySelector('.seg__btn[aria-pressed="true"]');
    if (!pill || !active) return;
    if (!animate) pill.style.transition = 'none';
    pill.style.width = `${active.offsetWidth}px`;
    pill.style.transform = `translateX(${active.offsetLeft}px)`;
    pill.style.opacity = '1';
    if (!animate) {
        void pill.offsetWidth;
        pill.style.transition = '';
    }
}

// Đặt lại viên trượt khi thanh được hiện lần đầu hoặc đổi cỡ, vì khi tab ẩn nó có chiều rộng 0.
function initChoice(container) {
    moveChoicePill(container, false);
    if (window.ResizeObserver) new ResizeObserver(() => moveChoicePill(container, false)).observe(container);
}

function setEntryMode(isLoan) {
    const current = $('modeLoanBtn').getAttribute('aria-pressed') === 'true';
    if (isLoan === current || swapBusy()) return;
    const outgoing = isLoan
        ? [$('transactionForm'), document.querySelector('.quick-add'), document.querySelector('.history-import')]
        : [$('loanForm')];
    // Phần cũ đi trước, phần mới vào sau: cùng nhịp chuyển trang lớn.
    swapBlock(outgoing, () => {
        ['modeTxBtn', 'modeLoanBtn'].forEach((id) => {
            const on = (id === 'modeLoanBtn') === isLoan;
            $(id).setAttribute('aria-pressed', String(on));
        });
        document.querySelector('.quick-add').hidden = isLoan;
        document.querySelector('.history-import').hidden = isLoan;
        $('transactionForm').hidden = isLoan;
        $('loanForm').hidden = !isLoan;
        moveChoicePill($('modeChoice'));
        if (isLoan) renderLoans();
    });
}

// Trong tab Danh sách: xem giao dịch hoặc khoản trả góp.
function setListView(isLoan) {
    if (isLoan === loanView.active || swapBusy()) return;
    const cards = [$('searchCard'), $('listCard')];
    // Cả hai thẻ đi cùng lúc, rồi vào lại cùng lúc với nhịp chuyển trang lớn.
    swapBlock(cards, () => {
        $('listModeTxBtn').setAttribute('aria-pressed', String(!isLoan));
        $('listModeLoanBtn').setAttribute('aria-pressed', String(isLoan));
        moveChoicePill($('listChoice'));
        if (isLoan) {
            loanView.savedMoreOpen = !$('filterMore').hidden;
            $('filterMore').hidden = true;
            fillSortOptions(LOAN_SORT_OPTIONS, loanView.sort);
        } else {
            $('filterMore').hidden = !loanView.savedMoreOpen;
            fillSortOptions(TX_SORT_OPTIONS, state.sort);
        }
        loanView.active = isLoan;
        $('listTitleText').textContent = isLoan ? 'Khoản trả góp' : 'Danh sách giao dịch';
        $('filterToggleBtn').hidden = isLoan;
        $('filterToggleBtn').setAttribute('aria-expanded', String(!$('filterMore').hidden));
        document.querySelectorAll('.list-view--tx').forEach((el) => { el.hidden = isLoan; });
        document.querySelector('.list-view--loan').hidden = !isLoan;
        renderListViews();
    }, cards);
}

function bindEntryMode() {
    initChoice($('modeChoice'));
    initChoice($('listChoice'));
    fillInstLenders();
    $('instLender').addEventListener('change', syncInstOther);
    $('instAddBtn').addEventListener('click', addInstLoanFromForm);
    $('modeTxBtn').addEventListener('click', () => setEntryMode(false));
    $('modeLoanBtn').addEventListener('click', () => setEntryMode(true));
    $('listModeTxBtn').addEventListener('click', () => setListView(false));
    $('listModeLoanBtn').addEventListener('click', () => setListView(true));
    bindInstallments();
}

document.addEventListener('DOMContentLoaded', bindEntryMode);


// Trạng thái xem khoản trả góp: đang bật hay không, cách sắp xếp riêng, và trạng thái mở của bộ lọc khi rời chế độ này.
const loanView = { active: false, sort: 'next-asc', savedMoreOpen: false };
const TX_SORT_OPTIONS = [['date-desc', 'Ngày mới nhất'], ['date-asc', 'Ngày cũ nhất'], ['amount-desc', 'Số tiền giảm dần'], ['amount-asc', 'Số tiền tăng dần']];
const LOAN_SORT_OPTIONS = [['next-asc', 'Kỳ kế tiếp gần nhất'], ['remaining-desc', 'Còn phải trả nhiều nhất']];

function fillSortOptions(options, value) {
    const sel = $('sortSelect');
    sel.innerHTML = '';
    options.forEach(([v, t]) => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = t;
        sel.appendChild(o);
    });
    sel.value = value;
}

// KHOẢN TRẢ GÓP: danh sách nằm trên đầu trang Giao dịch. Logic lưu nằm trong loans.js.
const LOAN_DELETE_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';

function loanRows() {
    const txs = getTransactions();
    const loans = readLoans();
    return loans.map((loan) => {
        const p = loanProgress(loan, txs);
        const settleTx = loan.settledTxId ? txs.find((t) => t.id === loan.settledTxId) : null;
        const settled = Boolean(settleTx);
        return {
            loan, p, settleTx, settled,
            remaining: settled || p.done ? 0 : p.remainingTotal,
            status: settled ? 'đã tất toán' : (p.done ? 'đã trả đủ' : 'đang trả'),
            candidates: loanCandidates(loan, txs, loans),
            settleCands: loanSettleCandidates(loan, txs, loans)
        };
    });
}

// Từ khóa tìm trên mọi trường của khoản vay: tên, số tiền, số kỳ, ngày, số còn phải trả, trạng thái.
function loanMatches(row, keyword) {
    const { loan, p, remaining, status } = row;
    const text = [
        loan.lenderName, loan.principal, loan.payment, formatCurrency(loan.principal), formatCurrency(loan.payment),
        loan.months, `${loan.months} kỳ`, loan.firstDue, p.nextDue || '', p.nextDue ? formatDate(p.nextDue) : '',
        remaining, formatCurrency(remaining), status, `đã trả ${p.paidCount}/${loan.months}`
    ].join(' ').toLowerCase();
    return text.includes(keyword);
}

function sortLoanRows(rows) {
    if (loanView.sort === 'remaining-desc') return rows.sort((a, b) => b.remaining - a.remaining);
    return rows.sort((a, b) => {
        const x = a.p.nextDue;
        const y = b.p.nextDue;
        if (!x && !y) return 0;
        if (!x) return 1;
        if (!y) return -1;
        return x < y ? -1 : x > y ? 1 : 0;
    });
}

function loanItemHtml(row, openIds) {
    const { loan, p, settleTx, settled, remaining, status, candidates, settleCands } = row;
    const id = escapeHtml(loan.id);
    const statusText = settled
        ? `Đã tất toán ${formatDate(settleTx.date)}`
        : p.done ? `Đã trả đủ ${loan.months} kỳ` : `Kỳ kế tiếp ${formatDate(p.nextDue)}`;
    const paidSet = new Set(loan.paidIds);

    const rows = candidates.length
        ? candidates.map((t) => `
            <li class="loan-tick">
                <label>
                    <input type="checkbox" data-loan="${id}" data-tx="${escapeHtml(t.id)}" ${paidSet.has(t.id) ? 'checked' : ''}>
                    <span class="loan-tick__title">${escapeHtml(t.title)}</span>
                    <span class="loan-tick__date">${formatDate(t.date)}</span>
                    <span class="loan-tick__amount">${formatCurrency(t.amount)}</span>
                </label>
            </li>`).join('')
        : '<li class="form-hint">Chưa có giao dịch nào khớp. Giao dịch chi đúng số tiền mỗi kỳ, có tên công ty trong tiêu đề, sẽ hiện ở đây.</li>';

    const settleBlock = settled
        ? `<div class="loan-item__settled">
                <span>Đã tất toán bằng “${escapeHtml(settleTx.title)}”, ${formatCurrency(settleTx.amount)}</span>
                <button type="button" class="btn-action" data-unsettle-loan="${id}">Bỏ tất toán</button>
           </div>`
        : `<div class="loan-item__settle" data-settle-box="${id}" hidden>
                <label class="form-label" for="settle-${id}">Giao dịch tất toán</label>
                <div class="loan-item__settle-row">
                    <select class="form-select" id="settle-${id}" data-settle-select="${id}"><option value="">Chọn giao dịch</option>${settleCands.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.title)}, ${formatCurrency(t.amount)}, ${formatDate(t.date)}</option>`).join('')}</select>
                    <button type="button" class="btn btn--small btn--primary" data-settle-confirm="${id}">Xác nhận</button>
                </div>
           </div>`;

    return `
    <article class="loan-item" data-status="${escapeHtml(status)}">
        <div class="transaction-item" data-loan-id="${id}">
            <div class="transaction__info">
                <h3 class="transaction__title">${escapeHtml(loan.lenderName)}</h3>
                <div class="transaction__meta">
                    <span>Vay ${formatCurrency(loan.principal)}</span>
                    <span>${loan.months} kỳ, ${formatCurrency(loan.payment)} mỗi kỳ</span>
                    <span>Đã trả ${p.paidCount}/${loan.months}</span>
                    <span>${statusText}</span>
                </div>
            </div>
            <div class="loan-item__remaining">
                <span class="loan-item__label">Còn phải trả</span>
                <span class="loan-item__value">${formatCurrency(remaining)}</span>
            </div>
            <div class="transaction__actions">
                ${settled ? '' : `<button type="button" class="btn-action" data-settle-open="${id}">Tất toán</button>`}
                <button type="button" class="btn-action btn-action--delete" data-remove-loan="${id}" aria-label="Xóa khoản vay" title="Xóa khoản vay">${LOAN_DELETE_ICON}</button>
            </div>
        </div>
        ${settleBlock}
        <details class="loan-item__ticks ${openIds.has(loan.id) ? 'is-open' : ''}" data-animate data-loan="${id}" open>
            <summary>Chọn các kỳ đã trả</summary>
            <ul class="loan-tick-list">${rows}</ul>
        </details>
    </article>`;
}

function renderLoans() {
    const list = $('loanList');
    // Giữ trạng thái mở của phần chọn kỳ khi vẽ lại sau mỗi lần tick.
    const openIds = new Set([...list.querySelectorAll('.loan-item__ticks.is-open')].map((d) => d.dataset.loan));
    const all = loanRows();
    if (!all.length) {
        list.innerHTML = '<p class="form-hint">Chưa có khoản trả góp nào. Thêm khoản vay bằng nút Khoản vay ở mục Thêm giao dịch.</p>';
        if (loanView.active) $('listCount').textContent = 'Hiển thị 0 / 0 khoản vay';
        return;
    }
    const keyword = $('searchInput').value.trim().toLowerCase();
    const rows = sortLoanRows(all.filter((r) => !keyword || loanMatches(r, keyword)));
    if (loanView.active) $('listCount').textContent = `Hiển thị ${rows.length} / ${all.length} khoản vay`;
    if (!rows.length) {
        list.innerHTML = '<div class="empty-state"><i data-icon="search"></i> Không tìm thấy khoản vay phù hợp.</div>';
        return;
    }
    list.innerHTML = rows.map((row) => loanItemHtml(row, openIds)).join('');
    if (window.bindDetailsAnim) window.bindDetailsAnim(list);
}

function bindInstallments() {
    const list = $('loanList');
    list.addEventListener('change', (e) => {
        const cb = e.target.closest('input[data-tx]');
        if (!cb) return;
        setLoanPayment(cb.dataset.loan, cb.dataset.tx, cb.checked);
        renderLoans();
    });
    list.addEventListener('click', (e) => {
        const open = e.target.closest('[data-settle-open]');
        if (open) {
            const box = list.querySelector(`[data-settle-box="${open.dataset.settleOpen}"]`);
            if (box.hidden) { box.hidden = false; return; }
            swapBlock([box], () => { box.hidden = true; });
            return;
        }
        const confirmBtn = e.target.closest('[data-settle-confirm]');
        if (confirmBtn) {
            const sel = list.querySelector(`[data-settle-select="${confirmBtn.dataset.settleConfirm}"]`);
            if (!sel.value) { window.alert('Chọn giao dịch dùng để tất toán.'); return; }
            setLoanSettled(confirmBtn.dataset.settleConfirm, sel.value);
            renderLoans();
            return;
        }
        const unsettle = e.target.closest('[data-unsettle-loan]');
        if (unsettle) {
            setLoanSettled(unsettle.dataset.unsettleLoan, null);
            renderLoans();
            return;
        }
        const btn = e.target.closest('[data-remove-loan]');
        if (!btn) return;
        if (!window.confirm('Xóa khoản vay này? Các giao dịch vẫn được giữ nguyên.')) return;
        removeLoan(btn.dataset.removeLoan);
        renderLoans();
    });
    renderLoans();
}
