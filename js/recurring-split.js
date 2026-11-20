// GIAO DỊCH ĐỊNH KỲ VÀ CHIA TIỀN NHÓM: hai tab ở trang Giao dịch.

function addSplitRow(name = '', paid = '') {
    const row = document.createElement('div');
    row.className = 'split-row';
    row.innerHTML = `
        <input type="text" class="form-input" data-split="name" maxlength="40" placeholder="Tên" aria-label="Tên người" value="${escapeHtml(name)}">
        <input type="number" class="form-input" data-split="paid" data-money min="0" step="1" inputmode="numeric" placeholder="Đã trả (VND)" aria-label="Số tiền đã trả" value="${paid}">
        <button type="button" class="btn btn--small" data-split="remove" aria-label="Xóa người này">×</button>`;
    $('splitRows').appendChild(row);
}

function readSplitRows() {
    return [...$('splitRows').querySelectorAll('.split-row')].map((row) => ({
        name: row.querySelector('[data-split="name"]').value,
        paid: parseMoney(row.querySelector('[data-split="paid"]').value) || 0
    }));
}

function updateSplit() {
    const people = readSplitRows().filter((p) => p.name.trim());
    if (people.length < 2) return setMessage('splitResult', 'Thêm ít nhất hai người để chia tiền.');
    const r = splitBill(people);
    if (r.total <= 0) return setMessage('splitResult', 'Nhập số tiền mà mỗi người đã trả.');
    const share = r.balances[0] ? r.balances[0].share : 0;
    const lines = [['Tổng chi', formatCurrency(r.total)], ['Mỗi người chịu khoảng', formatCurrency(share)]];
    if (r.transfers.length === 0) {
        lines.push(['Kết quả', 'Mọi người đã trả bằng nhau', 'good']);
    } else {
        r.transfers.forEach((t) => lines.push([`${t.from} chuyển cho ${t.to}`, formatCurrency(t.amount), 'bad']));
    }
    setResult('splitResult', lines);
}

// GIAO DỊCH ĐỊNH KỲ

function fillRecurringCategories() {
    const type = $('recType').value;
    const select = $('recCategory');
    select.innerHTML = '';
    getCategoriesFor(type).forEach((c) => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        select.appendChild(option);
    });
}

function renderRecurringList() {
    const list = $('recurringList');
    const rules = getRecurringRules();
    if (rules.length === 0) {
        list.innerHTML = '<p class="form-hint">Chưa có quy tắc định kỳ nào.</p>';
        return;
    }
    list.replaceChildren();
    rules.forEach((rule) => {
        const item = document.createElement('div');
        item.className = `recurring-item recurring-item--${rule.type}`;
        const info = document.createElement('div');
        info.className = 'recurring-item__info';
        const title = document.createElement('strong');
        title.textContent = rule.title;
        const meta = document.createElement('span');
        meta.className = 'recurring-item__meta';
        const range = rule.endMonth
            ? `${formatMonth(rule.startMonth)} đến ${formatMonth(rule.endMonth)}`
            : `từ ${formatMonth(rule.startMonth)}, không giới hạn`;
        meta.textContent = `${rule.category} · ngày ${rule.day} mỗi tháng · ${range}`;
        info.append(title, meta);
        const amount = document.createElement('span');
        amount.className = `recurring-item__amount ${rule.type}`;
        amount.textContent = `${rule.type === 'income' ? '+' : '−'}${formatCurrency(rule.amount)}`;
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn-action btn-action--delete';
        del.setAttribute('aria-label', 'Xóa quy tắc');
        del.title = 'Xóa quy tắc';
        del.innerHTML = makeIcon('trash');
        del.addEventListener('click', async () => {
            const ok = await confirmDialog('Xóa quy tắc', 'Xóa quy tắc này? Các giao dịch đã tạo từ quy tắc sẽ được giữ lại.', 'Xóa');
            if (!ok) return;
            if (!removeRecurringRule(rule.id)) return showToast('Không xóa được quy tắc.', 'danger');
            showToast('Đã xóa quy tắc.', 'danger');
            renderRecurringList();
        });
        item.append(info, amount, del);
        list.appendChild(item);
    });
}

function bindRecurringForm() {
    $('recType').addEventListener('change', fillRecurringCategories);
    $('recStart').value = getCurrentMonth();
    fillRecurringCategories();

    $('recurringForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
            title: $('recTitle').value,
            amount: parseMoney($('recAmount').value) ?? '',
            day: $('recDay').value,
            type: $('recType').value,
            category: $('recCategory').value,
            startMonth: $('recStart').value,
            endMonth: $('recEnd').value || null
        };
        const errors = {};
        if (!data.title.trim()) errors.recTitle = 'Vui lòng nhập tên khoản.';
        if (!Number.isInteger(data.amount) || data.amount <= 0) errors.recAmount = 'Số tiền phải là số nguyên dương.';
        if (!Number.isInteger(Number(data.day)) || Number(data.day) < 1 || Number(data.day) > 28) errors.recDay = 'Chọn ngày từ 1 đến 28.';
        if (!/^\d{4}-\d{2}$/.test(data.startMonth)) errors.recStart = 'Chọn tháng bắt đầu.';
        if (data.endMonth && data.endMonth < data.startMonth) errors.recEnd = 'Tháng kết thúc phải sau tháng bắt đầu.';
        ['recTitle', 'recAmount', 'recDay', 'recStart', 'recEnd'].forEach((id) => {
            $(`err-${id}`).textContent = errors[id] || '';
            $(id).classList.toggle('is-invalid', Boolean(errors[id]));
        });
        if (Object.keys(errors).length) return;

        const rule = addRecurringRule({ ...data, day: Number(data.day) });
        if (!rule) return showToast('Không lưu được quy tắc. Kiểm tra lại thông tin.', 'danger', 5000);
        const created = materializeRecurring();
        $('recTitle').value = '';
        $('recAmount').value = '';
        renderRecurringList();
        showToast(created ? `Đã thêm quy tắc và tạo ${created} giao dịch đã đến hạn.` : 'Đã thêm quy tắc định kỳ.');
    });
}


// KHỞI TẠO: chạy sau khi dữ liệu sẵn sàng.
onAppReady(() => {
    addSplitRow('Bạn');
    addSplitRow();
    addSplitRow();
    $('splitAddBtn').addEventListener('click', () => addSplitRow());
    $('splitRows').addEventListener('input', updateSplit);
    $('splitRows').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-split="remove"]');
        if (!btn) return;
        if ($('splitRows').querySelectorAll('.split-row').length <= 2) return;
        btn.closest('.split-row').remove();
        updateSplit();
    });
    bindRecurringForm();
    renderRecurringList();
    updateSplit();
});
