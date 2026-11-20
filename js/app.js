// Mỗi lần hiện 10 giao dịch trong danh sách. Phần còn lại bấm "Xem thêm".
const PAGE_SIZE = 10;

// Ghi nhớ đang sửa giao dịch nào, đang lọc gì và đang hiện bao nhiêu dòng.
const state = {
    editingId: null,
    personTouched: false,
    search: '',
    type: '',
    category: '',
    status: '',
    month: '',
    sort: 'date-desc',
    visibleCount: PAGE_SIZE
};

onAppReady(() => {
    migrateStoredData();
    const generated = materializeRecurring();
    bindModalDismissal();
    setDefaultDate();
    populateCategories();
    populateWallets();
    bindForm();
    bindFilters();
    bindList();
    bindToolbar();
    bindBudget();
    bindWallet();
    bindDebt();
    populateFilterCategories();
    populateMonthlyIncome();
    bindWeather();
    bindQuickAdd();
    bindShortcuts();
    loadWeather();
    refresh();
    if (generated) showToast(`Đã tạo ${generated} giao dịch từ mục định kỳ.`);
});

// NHẬP NHANH

// Đọc một dòng như "cơm trưa 45k hôm qua" và thêm giao dịch. Có nút Hoàn tác ngay trong thông báo.
function bindQuickAdd() {
    const submit = () => {
        const input = $('quickAddInput');
        const parsed = parseQuickEntry(input.value);
        if (parsed.error) {
            $('quickAddError').textContent = parsed.error;
            input.classList.add('is-invalid');
            return;
        }
        // Nhập nhanh "Thanh toán cho [tên] (...)" cũng tự gán cờ người nhận.
        const recipient = suggestRecipient(parsed.title);
        if (recipient) {
            parsed.personTransfer = true;
            parsed.recipient = recipient;
        }
        const saved = addTransaction(parsed);
        if (!saved) {
            showToast('Không lưu được giao dịch. Bộ nhớ trình duyệt có thể đã đầy.', 'danger', 5000);
            return;
        }
        $('quickAddError').textContent = '';
        input.classList.remove('is-invalid');
        input.value = '';
        state.visibleCount = PAGE_SIZE;
        refresh();
        showToast(`Đã thêm: ${saved.title} · ${formatCurrency(saved.amount)}`, 'success', 5000, undoAction(saved));
    };
    $('quickAddBtn').addEventListener('click', submit);
    $('quickAddInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submit();
        }
    });
    $('quickAddInput').addEventListener('input', () => {
        $('quickAddError').textContent = '';
        $('quickAddInput').classList.remove('is-invalid');
    });
}

// Nút Hoàn tác cho giao dịch vừa thêm nhanh: xóa đúng giao dịch đó.
function undoAction(tx) {
    return {
        label: 'Hoàn tác',
        onClick: () => {
            if (!deleteTransaction(tx.id)) {
                showToast('Không hoàn tác được.', 'danger');
                return;
            }
            showToast('Đã hoàn tác.');
            refresh();
        }
    };
}

// PHÍM TẮT: N để thêm giao dịch, / để tìm kiếm. Không kích hoạt khi đang gõ trong ô nhập.
function bindShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = (e.target && e.target.tagName) || '';
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || (e.target && e.target.isContentEditable)) return;
        if (document.querySelector('.modal.active')) return;
        if (e.key === 'n' || e.key === 'N') {
            e.preventDefault();
            showTxTab('add');
            $('quickAddInput').focus();
        } else if (e.key === '/') {
            e.preventDefault();
            showTxTab('list');
            $('searchInput').focus();
        }
    });
}

// Vẽ lại mọi phần liên quan đến số liệu sau mỗi lần thêm, sửa hoặc xóa.
function refresh() {
    renderSummary();
    renderBudgetAlert();
    renderList();
    if (typeof renderLoans === 'function') renderLoans();
}

// FORM

// Điền sẵn ngày hôm nay vào ô Ngày trên form.
function setDefaultDate() {
    $('date').value = toISODate();
}

// Đổ danh mục vào ô Danh mục đúng theo loại (thu hoặc chi) đang chọn.
function populateCategories(keepValue = '') {
    const select = $('category');
    const type = $('type').value;
    const categories = type ? getCategoriesFor(type) : [];

    select.innerHTML = '<option value="">Chọn danh mục</option>';
    categories.forEach((c) => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        select.appendChild(option);
    });
    if (keepValue && categories.includes(keepValue)) select.value = keepValue;
}

// Đổ danh mục vào ô lọc, gồm cả danh mục thu và chi.
function populateFilterCategories() {
    const select = $('categoryFilter');
    getAllCategories().forEach((c) => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        select.appendChild(option);
    });
}

// Đọc tất cả các ô trên form thành một gói dữ liệu để kiểm tra và lưu.
function readForm() {
    return {
        title: $('title').value,
        amount: parseMoney($('amount').value) ?? '',
        type: $('type').value,
        category: $('category').value,
        status: $('status').value,
        date: $('date').value,
        walletId: $('wallet').value || DEFAULT_WALLET_ID,
        personTransfer: $('personTransfer').checked,
        recipient: $('recipient').value.trim()
    };
}

// Tiêu đề dạng "Thanh toán cho [tên] (...)" được gợi ý là chuyển cho cá nhân. Trả về tên, hoặc null.
// Cùng quy tắc với luồng nhập từ ảnh. Người dùng vẫn có thể bỏ tick.
function suggestRecipient(title) {
    const m = /^Thanh toán cho\s+(.+?)\s*\(/i.exec(String(title ?? ''));
    return m ? m[1].trim().slice(0, 80) : null;
}

// Hiện hoặc ẩn ô tên người nhận theo ô tích.
function syncRecipientVisibility() {
    $('recipient').hidden = !$('personTransfer').checked;
    if (!$('personTransfer').checked) $('err-recipient').textContent = '';
}

// Khi đang gõ tiêu đề, tự tích và điền tên nếu khớp mẫu. Không ghi đè khi người dùng đã tự chọn.
function suggestPersonFromTitle() {
    if (state.personTouched) return;
    const name = suggestRecipient($('title').value);
    if (!name) return;
    $('personTransfer').checked = true;
    if (!$('recipient').value.trim()) $('recipient').value = name;
    syncRecipientVisibility();
}

// Hiện chữ đỏ dưới ô nhập sai và tô viền đỏ cho ô đó.
function showFieldErrors(errors) {
    ['title', 'amount', 'type', 'category', 'status', 'date'].forEach((field) => {
        const input = $(field);
        const errorEl = $(`err-${field}`);
        const message = errors[field] || '';
        input.classList.toggle('is-invalid', Boolean(message));
        input.setAttribute('aria-invalid', String(Boolean(message)));
        errorEl.textContent = message;
    });
}

// Xóa hết thông báo lỗi trên form.
function clearFieldErrors() {
    showFieldErrors({});
}

// Khi bấm "Sửa": đưa dữ liệu của dòng đó lên form và đổi nút thành "Cập nhật".
function enterEditMode(tx) {
    state.editingId = tx.id;
    $('title').value = tx.title;
    setMoneyValue($('amount'), tx.amount);
    $('type').value = tx.type;
    populateCategories(tx.category);
    $('status').value = tx.status;
    $('date').value = tx.date;
    populateWallets(tx.walletId);
    $('personTransfer').checked = Boolean(tx.personTransfer);
    $('recipient').value = tx.recipient || '';
    state.personTouched = true;
    syncRecipientVisibility();

    $('formTitle').innerHTML = '<i data-icon="pencil"></i> Sửa giao dịch';
    $('submitBtn').textContent = 'Cập nhật';
    $('cancelEditBtn').hidden = false;
    clearFieldErrors();
}

// Form sửa nằm trong hộp thoại riêng. Form gốc được chuyển sang đó và trả về chỗ cũ khi đóng.
function openEditModal() {
    const form = $('transactionForm');
    const body = $('editModalBody');
    if (form.parentNode !== body) {
        state.formHome = { parent: form.parentNode, next: form.nextSibling };
        body.appendChild(form);
    }
    openModal('editModal');
}

// Đóng hộp thoại sửa với hiệu ứng, rồi trả form về chỗ cũ sau khi hiệu ứng xong.
function closeEditModal() {
    const modal = $('editModal');
    if (!modal) return;
    hideModal(modal);
    setTimeout(restoreTxForm, modal.classList.contains('is-closing') ? motionTokens.ms('base') : 0);
}

function restoreTxForm() {
    const modal = $('editModal');
    if (modal && modal.classList.contains('active')) return;
    const form = $('transactionForm');
    if (state.formHome && form.parentNode === $('editModalBody')) {
        state.formHome.parent.insertBefore(form, state.formHome.next);
    }
    state.formHome = null;
}

// Thoát chế độ sửa và xóa form về trạng thái để nhập giao dịch mới.
function exitEditMode() {
    state.editingId = null;
    $('transactionForm').reset();
    setDefaultDate();
    populateCategories();
    populateWallets();
    state.personTouched = false;
    syncRecipientVisibility();
    $('formTitle').innerHTML = '<i data-icon="plus"></i> Thêm giao dịch';
    $('submitBtn').textContent = 'Thêm giao dịch';
    $('cancelEditBtn').hidden = true;
    clearFieldErrors();
    closeEditModal();
}

// Chạy khi bấm nút lưu: kiểm tra dữ liệu, thêm hoặc cập nhật giao dịch, rồi vẽ lại màn hình.
function handleSubmit(e) {
    e.preventDefault();
    const data = readForm();
    const { isValid, errors } = validateTransaction(data);
    showFieldErrors(errors);

    if (data.personTransfer && !data.recipient) {
        $('err-recipient').textContent = 'Nhập tên người nhận hoặc bỏ tick "Chuyển cho cá nhân".';
        $('recipient').focus();
        return;
    }
    $('err-recipient').textContent = '';

    if (!isValid) {
        const firstInvalid = document.querySelector('.is-invalid');
        if (firstInvalid) firstInvalid.focus();
        return;
    }

    const saved = state.editingId
        ? updateTransaction(state.editingId, data)
        : addTransaction(data);

    if (!saved) {
        showToast('Không lưu được giao dịch. Bộ nhớ trình duyệt có thể đã đầy hoặc bị chặn.', 'danger', 5000);
        return;
    }
    showToast(state.editingId ? 'Đã cập nhật giao dịch.' : 'Đã thêm giao dịch.');

    exitEditMode();
    state.visibleCount = PAGE_SIZE;
    refresh();
}

// Gắn "tai nghe" cho form: khi bấm lưu, đổi loại thu/chi, hủy sửa hay làm mới thì hàm tương ứng sẽ chạy.
function bindForm() {
    $('transactionForm').addEventListener('submit', handleSubmit);
    $('title').addEventListener('input', suggestPersonFromTitle);
    $('personTransfer').addEventListener('change', () => {
        state.personTouched = true;
        syncRecipientVisibility();
    });
    $('recipient').addEventListener('input', () => { state.personTouched = true; });
    $('type').addEventListener('change', () => populateCategories());
    $('cancelEditBtn').addEventListener('click', exitEditMode);
    $('closeEditModal').addEventListener('click', exitEditMode);
    $('resetFormBtn').addEventListener('click', exitEditMode);
    $('monthlyIncome').addEventListener('change', saveMonthlyIncomeFromForm);
    // Ô này nằm trong form: Enter ở đây chỉ lưu thu nhập, không gửi form thêm giao dịch.
    $('monthlyIncome').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveMonthlyIncomeFromForm();
        }
    });
}

// Ô \"Thu nhập tháng này\" nằm cạnh ô số tiền. Số này dùng để tính tỷ lệ chi so với thu trong tháng.
function populateMonthlyIncome() {
    const income = getMonthlyIncome(getCurrentMonth());
    setMoneyValue($('monthlyIncome'), income);
}

function saveMonthlyIncomeFromForm() {
    const amount = parseMoney($('monthlyIncome').value) ?? 0;
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
        showToast('Thu nhập không hợp lệ.', 'danger');
        populateMonthlyIncome();
        return;
    }
    setMonthlyIncome(getCurrentMonth(), amount);
    renderSummary();
    showToast(amount > 0 ? 'Đã lưu thu nhập tháng này.' : 'Đã xóa thu nhập tháng này.');
}

// FILTERS

// Gắn "tai nghe" cho các ô lọc: thay đổi là danh sách cập nhật ngay.
function bindFilters() {
    const onChange = (key, el) => () => {
        state[key] = el.value;
        state.visibleCount = PAGE_SIZE;
        renderListViews();
    };

    $('searchInput').addEventListener('input', onChange('search', $('searchInput')));
    $('typeFilter').addEventListener('change', onChange('type', $('typeFilter')));
    $('categoryFilter').addEventListener('change', onChange('category', $('categoryFilter')));
    $('statusFilter').addEventListener('change', onChange('status', $('statusFilter')));
    $('monthFilter').addEventListener('change', onChange('month', $('monthFilter')));

    // Sắp xếp dùng chung một ô, nhưng mỗi chế độ giữ lựa chọn riêng.
    $('sortSelect').addEventListener('change', () => {
        if (loanView.active) loanView.sort = $('sortSelect').value;
        else state.sort = $('sortSelect').value;
        state.visibleCount = PAGE_SIZE;
        renderListViews();
    });

    $('filterToggleBtn').addEventListener('click', () => {
        const more = $('filterMore');
        const opening = more.hidden;
        $('filterToggleBtn').setAttribute('aria-expanded', String(opening));
        if (opening) { more.hidden = false; return; }
        swapBlock([more], () => { more.hidden = true; });
    });

    $('clearFiltersBtn').addEventListener('click', () => {
        Object.assign(state, { search: '', type: '', category: '', status: '', month: '', sort: 'date-desc', visibleCount: PAGE_SIZE });
        ['searchInput', 'typeFilter', 'categoryFilter', 'statusFilter', 'monthFilter'].forEach((id) => { $(id).value = ''; });
        if (loanView.active) {
            loanView.sort = 'next-asc';
            $('sortSelect').value = 'next-asc';
        } else {
            $('sortSelect').value = 'date-desc';
        }
        renderListViews();
    });

    $('loadMoreBtn').addEventListener('click', () => {
        state.visibleCount += PAGE_SIZE;
        renderListViews();
    });
}

// Lấy các điều kiện lọc và sắp xếp, rồi trả về danh sách phù hợp.
function applyFilters(list) {
    const keyword = state.search.trim().toLowerCase();

    let result = list.filter((t) => {
        if (state.type && t.type !== state.type) return false;
        if (state.category && t.category !== state.category) return false;
        if (state.status && t.status !== state.status) return false;
        if (state.month && !t.date.startsWith(state.month)) return false;
        if (keyword && !(t.title.toLowerCase().includes(keyword) || t.category.toLowerCase().includes(keyword))) return false;
        return true;
    });

    const sorters = {
        'date-desc': (a, b) => b.date.localeCompare(a.date) || b.createdDate.localeCompare(a.createdDate),
        'date-asc': (a, b) => a.date.localeCompare(b.date) || a.createdDate.localeCompare(b.createdDate),
        'amount-desc': (a, b) => b.amount - a.amount,
        'amount-asc': (a, b) => a.amount - b.amount
    };
    return result.sort(sorters[state.sort] || sorters['date-desc']);
}

// LIST

// Vẽ danh sách giao dịch lên màn hình, chỉ hiện số dòng được phép.
// Vẽ lại danh sách giao dịch, và khoản trả góp nếu đang xem chế độ này.
function renderListViews() {
    renderList();
    if (loanView.active) renderLoans();
}

function renderList() {
    const all = getTransactions();
    const filtered = applyFilters(all);
    const container = $('transactionsList');
    const visible = filtered.slice(0, state.visibleCount);

    $('listCount').textContent = `Hiển thị ${visible.length} / ${filtered.length} giao dịch`;

    if (filtered.length === 0) {
        container.innerHTML = all.length === 0
            ? '<div class="empty-state"><i data-icon="inbox"></i> Chưa có giao dịch nào. Hãy thêm giao dịch đầu tiên!</div>'
            : '<div class="empty-state"><i data-icon="search"></i> Không tìm thấy giao dịch phù hợp bộ lọc.</div>';
    } else {
        container.innerHTML = visible.map(createTransactionItem).join('');
    }

    $('loadMoreWrap').hidden = visible.length >= filtered.length;
}

// Tạo khung HTML cho một dòng giao dịch: tên, ngày, số tiền, nút Sửa và Xóa.
function createTransactionItem(tx) {
    const isIncome = tx.type === 'income';
    const isCompleted = tx.status === 'completed';
    const id = escapeHtml(tx.id);

    return `
        <article class="transaction-item ${tx.type}" data-id="${id}">
            <div class="transaction__info">
                <h3 class="transaction__title">${escapeHtml(tx.title)}</h3>
                <div class="transaction__meta">
                    <span class="transaction__category">${categoryIcon(tx.category)} ${escapeHtml(tx.category)}</span>
                    <span class="transaction__date"><i data-icon="calendar"></i> ${formatDate(tx.date)}</span>
                    <span class="transaction__status ${isCompleted ? 'completed' : 'pending'}">
                        ${isCompleted ? 'Hoàn thành' : 'Chưa thanh toán'}
                    </span>
                </div>
            </div>
            <div class="transaction__amount ${isIncome ? 'income' : 'expense'}">
                <i data-icon="${isIncome ? 'arrow-up' : 'arrow-down'}" data-class="amount-arrow"></i>${isIncome ? '+' : '−'}${formatCurrency(tx.amount)}
            </div>
            <div class="transaction__actions">
                <button class="btn-action btn-action--toggle" data-action="toggle" data-id="${id}">
                    ${isCompleted ? '<i data-icon="rotate"></i> Chưa trả' : '<i data-icon="check"></i> Hoàn thành'}
                </button>
                <button class="btn-action btn-action--edit" data-action="edit" data-id="${id}"><i data-icon="pencil"></i> Sửa</button>
                <button class="btn-action btn-action--delete" data-action="delete" data-id="${id}" aria-label="Xóa giao dịch" title="Xóa giao dịch"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
            </div>
        </article>`;
}

// Một "tai nghe" duy nhất cho cả danh sách. Bấm nút nào thì xem nút đó thuộc dòng nào để làm việc tương ứng.
function bindList() {
    $('transactionsList').addEventListener('click', async (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;

        const id = button.dataset.id;
        const action = button.dataset.action;

        if (action === 'toggle') {
            if (!toggleTransactionStatus(id)) {
                showToast('Không cập nhật được trạng thái.', 'danger');
                return;
            }
            showToast('Đã cập nhật trạng thái.');
            refresh();
        } else if (action === 'edit') {
            const tx = getTransactionById(id);
            if (tx) {
                openEditModal();
                enterEditMode(tx);
            }
        } else if (action === 'delete') {
            const ok = await confirmDialog('Xóa giao dịch', 'Bạn chắc chắn muốn xóa giao dịch này?', 'Xóa');
            if (!ok) return;
            const removed = getTransactionById(id);
            if (state.editingId === id) exitEditMode();
            if (!deleteTransaction(id)) {
                showToast('Không xóa được giao dịch.', 'danger');
                return;
            }
            refresh();
            if (removed) {
                showToast('Đã xóa giao dịch.', 'danger', 6000, {
                    label: 'Hoàn tác',
                    onClick: () => {
                        if (restoreTransaction(removed)) {
                            showToast('Đã khôi phục giao dịch.');
                            refresh();
                        } else {
                            showToast('Không khôi phục được giao dịch.', 'danger');
                        }
                    }
                });
            } else {
                showToast('Đã xóa giao dịch.', 'danger');
            }
        }
    });
}

// SUMMARY & BUDGET

// Điền 4 ô tổng quan ở đầu trang: số chính, badge % so với tháng trước và chú thích nhỏ.
function renderSummary() {
    const all = getTransactions();
    const month = getCurrentMonth();
    const year = month.slice(0, 4);
    const yearStats = summarize(all.filter((t) => t.date.startsWith(year)));
    const { current, previous } = compareWithPreviousMonth(all, month);
    const stats = summarize(all);

    // Hàng 1: tổng theo năm hiện tại.
    countTo($('yearIncome'), yearStats.income);
    countTo($('yearExpense'), yearStats.expense);
    countTo($('yearBalance'), yearStats.balance);
    setBadge($('yearBalanceTrend'), savingsInfo(yearStats));
    $('yearBalanceNote').textContent = `Thu − chi trong năm ${year} · tính từ tất cả ví`;

    // Hàng 2: số liệu của tháng hiện tại.
    countTo($('monthIncomeKpi'), current.income);
    setBadge($('incomeTrend'), trendInfo(percentChange(current.income, previous.income), true));
    $('incomeNote').textContent = `Tháng này · so với tháng trước`;

    countTo($('monthExpense'), current.expense);

    countTo($('monthBalance'), current.balance);
    // Tổng tài sản luôn hiện trên trang chính, không phụ thuộc tháng đang xem.
    const walletCount = getWallets().length;
    countTo($('totalAssets'), getTotalAssets());
    $('totalAssetsNote').textContent = walletCount > 1
        ? `Cộng số dư của ${walletCount} ví`
        : 'Cộng số dư của ví Mặc định';
    // Số dư từng ví theo thứ tự ví 1, ví 2, ... (ví Mặc định luôn đứng đầu).
    $('walletBalances').innerHTML = getWalletBalances().map((w) => `
        <li class="kpi__wallet-row">
            <span class="kpi__wallet-name">${escapeHtml(w.name)}</span>
            <span class="kpi__wallet-amount ${w.balance < 0 ? 'is-negative' : ''}">${formatCurrency(w.balance)}</span>
        </li>`).join('');
    renderNetWorth();
    setBadge($('monthBalanceTrend'), savingsInfo(current));
    const monthIncome = getMonthlyIncome(month);
    $('monthBalanceNote').textContent = monthIncome
        ? `Thu nhập ${formatCurrency(monthIncome)} · đã chi ${Math.round((current.expense / monthIncome) * 100)}%`
        : `Thu − chi tháng này: ${formatCurrency(current.balance)}`;

    $('transactionCount').textContent =
        `${stats.completed} hoàn thành · ${stats.pending} chưa thanh toán`;

    const budgetStatus = getBudgetStatus(month);
    if (budgetStatus) {
        const tone = { ok: 'good', warning: 'warn', danger: 'bad' }[budgetStatus.level];
        setBadge($('budgetTrend'), { text: `${Math.round(budgetStatus.percent)}% ngân sách`, trend: 'flat', tone });
        const today = new Date();
        const forecast = forecastMonthEnd(current.expense, today.getDate(), new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate());
        $('budgetNote').textContent = forecast === null
            ? `Ngân sách tháng ${formatCurrency(budgetStatus.budget)}`
            : `Dự kiến cuối tháng ${formatCurrency(forecast)} · ngân sách ${formatCurrency(budgetStatus.budget)}`;
    } else {
        setBadge($('budgetTrend'), null);
        $('budgetNote').textContent = 'Chưa đặt ngân sách tháng này';
    }
}

// Hiện khung cảnh báo ngân sách: bình thường, sắp đầy (80%) hay vượt (100%).
function renderBudgetAlert() {
    const box = $('budgetWarning');
    const status = getBudgetStatus(getCurrentMonth());

    if (!status) {
        box.innerHTML = '';
        return;
    }

    box.innerHTML = budgetCardHTML(status);
    animateBudgetGauges(box);
}

// Mở hộp đặt ngân sách và điền sẵn số đã có.
function openBudgetModal() {
    const budget = getBudget();
    setMoneyValue($('budgetInput'), budget);
    $('removeBudgetBtn').hidden = !budget;
    $('budgetError').textContent = '';
    openModal('budgetModal');
}

// Gắn "tai nghe" cho hộp ngân sách: mở, đóng, lưu và xóa.
function bindBudget() {
    $('budgetBtn').addEventListener('click', openBudgetModal);
    $('closeBudgetModal').addEventListener('click', () => closeModal('budgetModal'));
    $('cancelBudgetBtn').addEventListener('click', () => closeModal('budgetModal'));

    $('saveBudgetBtn').addEventListener('click', () => {
        const value = String(parseMoney($('budgetInput').value) ?? '');
        const { isValid, error } = validateBudget(value);
        if (!isValid) {
            $('budgetError').textContent = error;
            return;
        }
        if (!setBudget(Number(value))) {
            $('budgetError').textContent = 'Không lưu được ngân sách. Kiểm tra bộ nhớ trình duyệt.';
            return;
        }
        closeModal('budgetModal');
        showToast('Đã lưu ngân sách tháng.');
        refresh();
    });

    $('removeBudgetBtn').addEventListener('click', async () => {
        const ok = await confirmDialog('Xóa ngân sách', 'Bỏ ngân sách tháng hiện tại?', 'Xóa');
        if (!ok) return;
        if (!removeBudget()) {
            showToast('Không xóa được ngân sách.', 'danger');
            return;
        }
        closeModal('budgetModal');
        showToast('Đã xóa ngân sách.', 'danger');
        refresh();
    });
}

// TOOLBAR: EXPORT / IMPORT / RESET

// Gắn "tai nghe" cho các nút công cụ: xuất file, nhập file, xóa toàn bộ, đặt ngân sách.
function bindToolbar() {
    $('exportJsonBtn').addEventListener('click', () => {
        downloadFile(`giao-dich_${toISODate()}.json`, exportAsJSON(), 'application/json');
        showToast('Đã xuất file JSON.');
    });

    $('exportCsvBtn').addEventListener('click', () => {
        downloadFile(`giao-dich_${toISODate()}.csv`, exportAsCSV(), 'text/csv');
        showToast('Đã xuất file CSV ẩn danh.');
    });

    $('importBtn').addEventListener('click', () => $('importFile').click());

    $('importFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;

        try {
            const text = await file.text();
            const { imported, skipped, duplicates } = importTransactions(text);
            const notes = [];
            if (duplicates) notes.push(`bỏ qua ${duplicates} giao dịch đã có`);
            if (skipped) notes.push(`bỏ qua ${skipped} dòng không hợp lệ`);
            showToast(`Đã nhập ${imported} giao dịch${notes.length ? `, ${notes.join(', ')}` : ''}.`);
            refresh();
        } catch (error) {
            showToast(`Nhập thất bại: ${error.message}`, 'danger', 5000);
        }
    });

    $('clearDataBtn').addEventListener('click', async () => {
        const ok = await confirmDialog(
            'Xóa toàn bộ dữ liệu',
            'Thao tác này xóa mọi giao dịch và ngân sách, không thể hoàn tác. Hãy xuất file backup trước nếu cần.',
            'Xóa tất cả'
        );
        if (!ok) return;
        if (!clearAllData()) {
            showToast('Không xóa được dữ liệu. Thử lại sau.', 'danger');
            return;
        }
        exitEditMode();
        showToast('Đã xóa toàn bộ dữ liệu.', 'danger');
        refresh();
    });
}

// WEATHER (public API – see api.js)

// Tên các thứ trong tuần bằng tiếng Việt (Hai, Ba, Tư...).
const WEEKDAYS_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// Từ ngày như 2026-10-14, tìm ra đó là thứ mấy trong tuần.
function weekdayLabel(isoDate, index) {
    if (index === 0) return 'Hôm nay';
    const [y, m, d] = isoDate.split('-').map(Number);
    return WEEKDAYS_VI[new Date(y, m - 1, d).getDay()];
}

// Gọi lấy thời tiết và vẽ khối thời tiết. Nếu lỗi thì hiện thông báo kèm nút thử lại.
async function loadWeather(forceRefresh = false) {
    const box = $('weatherBox');
    box.innerHTML = '<p class="form-hint">Đang tải dự báo...</p>';

    try {
        const w = await getWeather({ forceRefresh });
        const today = w.days[0];
        const days = w.days.slice(1).map((d, i) => `
            <li class="weather-widget__day">
                <span class="weather-widget__day-name">${weekdayLabel(d.date, i + 1)}</span>
                <span class="weather-widget__day-icon" aria-label="${escapeHtml(d.text)}"><i data-icon="${d.icon}"></i></span>
                <span class="weather-widget__day-temp">${d.max}°/${d.min}°</span>
            </li>`).join('');

        box.innerHTML = `
            <div class="weather-widget">
                <div class="weather-widget__head">
                    <span class="weather-widget__city"><i data-icon="navigation"></i>${escapeHtml(w.city)}</span>
                    <button type="button" class="weather-widget__refresh" data-weather-action="refresh" aria-label="Cập nhật thời tiết" title="Cập nhật">
                        <i data-icon="rotate"></i>
                    </button>
                </div>
                <div class="weather-widget__main">
                    <div>
                        <div class="weather-widget__temp">${w.current.temperature}°</div>
                        <div class="weather-widget__cond">${escapeHtml(w.current.text)}</div>
                    </div>
                    <span class="weather-widget__icon" aria-hidden="true"><i data-icon="${w.current.icon}"></i></span>
                </div>
                <div class="weather-widget__hl">H:${today.max}° L:${today.min}°</div>
                <ul class="weather-widget__forecast" aria-label="Dự báo 2 ngày tới">${days}</ul>
            </div>`;
    } catch (error) {
        box.innerHTML = `
            <div class="weather-widget weather-widget--error">
                <p class="weather-widget__error" role="alert">${escapeHtml(error.message)}</p>
                <button type="button" class="weather-widget__retry" data-weather-action="retry">Thử lại</button>
            </div>`;
    }
}

// Gắn "tai nghe" cho nút Cập nhật và Thử lại của khối thời tiết.
function bindWeather() {
    $('weatherBox').addEventListener('click', (e) => {
        const action = e.target.closest('button[data-weather-action]')?.dataset.weatherAction;
        if (action === 'retry' || action === 'refresh') loadWeather(true);
    });
}

// TABS: ba nhóm ở cột giữa. Chỉ đổi hiển thị, không ảnh hưởng dữ liệu.
function showTxTab(name, animate = true) {
    const tabs = Array.from(document.querySelectorAll('.layout__main .tabs__btn'));
    if (!tabs.length) return;
    if (animate && swapBusy()) return;
    // Tab và viên trượt đổi ngay, nội dung cũ đi rồi nội dung mới vào, cùng nhịp chuyển trang lớn.
    tabs.forEach((tab) => {
        const on = tab.dataset.tab === name;
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
    });
    movePill(animate);
    const showPanels = () => {
        document.querySelectorAll('.layout__main .tab-panel').forEach((p) => {
            p.hidden = p.id !== `panel-${name}`;
        });
    };
    if (!animate) { showPanels(); return; }
    const outgoing = Array.from(document.querySelectorAll('.layout__main .tab-panel')).filter((p) => p.id !== `panel-${name}`);
    swapBlock(outgoing, showPanels);
}

// Đặt viên trượt dưới tab đang chọn. animate=false khi tải trang hoặc đổi cỡ màn hình.
function movePill(animate = true) {
    const pill = document.querySelector('.layout__main .tabs__pill');
    const active = document.querySelector('.layout__main .tabs__btn[aria-selected="true"]');
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

function initTxTabs() {
    const tabs = Array.from(document.querySelectorAll('.layout__main .tabs__btn'));
    if (!tabs.length) return;
    tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => showTxTab(tab.dataset.tab));
        tab.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
            next.focus();
            showTxTab(next.dataset.tab);
        });
    });
    showTxTab('add', false);
    window.addEventListener('resize', () => movePill(false));
    if (document.fonts) document.fonts.ready.then(() => movePill(false));
}

document.addEventListener('DOMContentLoaded', initTxTabs);

// VÍ: danh sách chọn trong form và cửa sổ quản lý ví

// Đổ danh sách ví vào ô chọn. Nếu có ví được chọn sẵn (khi sửa) thì giữ lại.
function populateWallets(selectedId = DEFAULT_WALLET_ID) {
    const select = $('wallet');
    const wallets = getWallets();
    select.innerHTML = wallets.map((w) => `<option value="${escapeHtml(w.id)}">${escapeHtml(w.name)}</option>`).join('');
    select.value = wallets.some((w) => w.id === selectedId) ? selectedId : DEFAULT_WALLET_ID;
}

// Vẽ lại danh sách ví trong cửa sổ, kèm số dư hiện tại của từng ví.
function renderWalletList() {
    const list = $('walletList');
    const items = getWalletBalances();
    list.innerHTML = items.map((w) => `
        <li class="wallet-row">
            <span class="wallet-row__name">${escapeHtml(w.name)}</span>
            <span class="wallet-row__balance ${w.balance < 0 ? 'is-negative' : ''}">${formatCurrency(w.balance)}</span>
            ${w.id === DEFAULT_WALLET_ID
                ? '<span class="wallet-row__tag">mặc định</span>'
                : `<button type="button" class="btn btn--small btn--danger" data-remove-wallet="${escapeHtml(w.id)}">Xóa</button>`}
        </li>`).join('');
}

function bindWallet() {
    $('walletBtn').addEventListener('click', () => {
        $('walletName').value = '';
        setMoneyValue($('walletOpening'), '');
        $('walletNameError').textContent = '';
        renderWalletList();
        openModal('walletModal');
    });
    $('closeWalletModal').addEventListener('click', () => closeModal('walletModal'));
    $('closeWalletModalFooter').addEventListener('click', () => closeModal('walletModal'));

    $('addWalletBtn').addEventListener('click', () => {
        const name = $('walletName').value.trim();
        const opening = parseMoney($('walletOpening').value) ?? 0;
        if (!name) {
            $('walletNameError').textContent = 'Nhập tên ví.';
            return;
        }
        if (!addWallet(name, opening)) {
            $('walletNameError').textContent = 'Tên đã tồn tại hoặc không hợp lệ.';
            return;
        }
        $('walletName').value = '';
        setMoneyValue($('walletOpening'), '');
        $('walletNameError').textContent = '';
        populateWallets();
        renderWalletList();
        refresh();
        showToast(`Đã thêm ví ${name}.`);
    });

    $('walletList').addEventListener('click', (e) => {
        const id = e.target.dataset.removeWallet;
        if (!id) return;
        if (!removeWallet(id)) {
            showToast('Không xóa được ví.', 'danger', 4000);
            return;
        }
        populateWallets();
        renderWalletList();
        refresh();
        showToast('Đã xóa ví. Giao dịch đã chuyển về Mặc định.');
    });
}

// Tài sản ròng và danh sách khoản vay, nợ.
function renderNetWorth() {
    const assets = getTotalAssets();
    const debts = getTotalDebts();
    const cash = assets - debts;
    countTo($('netWorth'), cash);
    $('netWorthInline').textContent = formatCurrency(cash);
    $('netAssets').textContent = formatCurrency(assets);
    $('netDebts').textContent = formatCurrency(debts);
    $('netWorthNote').textContent = debts > 0
        ? 'Tiền trong các ví, sau khi trừ số đang nợ'
        : 'Chưa có khoản nợ, bằng toàn bộ tiền trong các ví';
    const items = readDebts();
    // Khoản trả góp còn phải trả hiện cùng danh sách nhưng không xóa ở đây. Quản lý ở mục Công cụ.
    const txs = getTransactions();
    const loanRows = readLoans().map((l) => ({ l, p: loanProgress(l, txs) })).filter((x) => !x.p.done);
    $('debtList').innerHTML = (items.length || loanRows.length)
        ? items.map((d) => `
            <li class="debt-row">
                <span class="debt-row__name">${escapeHtml(d.name)}</span>
                <span class="debt-row__amount">${formatCurrency(d.balance)}</span>
                <button type="button" class="btn btn--small btn--danger" data-remove-debt="${escapeHtml(d.id)}">Xóa</button>
            </li>`).join('') + loanRows.map(({ l, p }) => `
            <li class="debt-row">
                <span class="debt-row__name">Trả góp ${escapeHtml(l.lenderName)} (còn ${p.remainingPayments} kỳ)</span>
                <span class="debt-row__amount">${formatCurrency(p.remainingTotal)}</span>
            </li>`).join('')
        : '<li class="debt-row debt-row--empty">Chưa có khoản nợ.</li>';
}

function bindDebt() {
    $('addDebtBtn').addEventListener('click', () => {
        const name = $('debtName').value.trim();
        const balance = parseMoney($('debtBalance').value);
        if (!name) {
            $('debtError').textContent = 'Nhập tên khoản nợ.';
            return;
        }
        if (balance === null || balance < 0) {
            $('debtError').textContent = 'Nhập số tiền còn nợ.';
            return;
        }
        addDebt(name, balance);
        $('debtName').value = '';
        setMoneyValue($('debtBalance'), '');
        $('debtError').textContent = '';
        renderNetWorth();
    });
    $('debtList').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-remove-debt]');
        if (!btn || !confirm('Xóa khoản nợ này?')) return;
        removeDebt(btn.dataset.removeDebt);
        renderNetWorth();
    });
}
