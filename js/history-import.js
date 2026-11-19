// ----------------------------------------------------------------------------
// Nhập giao dịch từ ảnh lịch sử (ngân hàng hoặc ví). Đọc chữ bằng Tesseract.js,
// tách dòng bằng parseBankHistory, rồi hiện danh sách để người dùng xác nhận.
// Chỉ khi bấm xác nhận thì các giao dịch mới được ghi vào danh sách.
// Ảnh chỉ nằm trong bộ nhớ tạm, không được lưu.
// ----------------------------------------------------------------------------

const HISTORY_MIN_WIDTH = 1400;
const HISTORY_MEMORY_KEY = 'history_category_memory';

(function initHistoryImport() {
    let img = null;
    let busy = false;
    let items = []; // { checked, date, description, amount, type, category, walletId, manual }

    const setError = (msg) => { $('historyError').textContent = msg || ''; };
    const setStatus = (msg) => { $('historyStatus').textContent = msg || ''; };

    // Khóa nhớ: nội dung giao dịch viết thường, bỏ số và ký hiệu, để cùng một đối tác
    // thì nhận ra dù OCR đọc hơi khác nhau.
    function memoryKey(description) {
        return String(description || '')
            .toLowerCase()
            .replace(/[0-9]/g, ' ')
            .replace(/[^\p{L}\s]/gu, ' ')
            .split(' ')
            .filter((w) => w.length > 1)
            .join(' ')
            .slice(0, 60);
    }

    function loadCategoryMemory() {
        try {
            return JSON.parse(localStorage.getItem(HISTORY_MEMORY_KEY) || '{}') || {};
        } catch (e) {
            return {};
        }
    }

    function saveCategoryMemory(key, category) {
        if (!key) return;
        const memory = loadCategoryMemory();
        memory[key] = category;
        try {
            localStorage.setItem(HISTORY_MEMORY_KEY, JSON.stringify(memory));
        } catch (e) {
            // Bộ nhớ đầy hoặc bị chặn: vẫn dùng được, chỉ không nhớ cho lần sau.
        }
    }

    // Ưu tiên danh mục đã nhớ cho đối tác này, sau đó mới đến từ khóa.
    function guessCategory(description, type) {
        const remembered = loadCategoryMemory()[memoryKey(description)];
        const allowed = getCategoriesFor(type);
        if (remembered && allowed.includes(remembered)) return remembered;
        const text = description || '';
        if (type === 'income') {
            const hit = QUICK_INCOME_RULES.find(([re]) => re.test(text));
            return hit ? hit[1].category : 'Khác';
        }
        const hit = QUICK_EXPENSE_RULES.find(([re]) => re.test(text));
        return hit ? hit[1] : 'Chưa phân loại';
    }

    function resetPanel() {
        img = null;
        clearPreview('historyPreview');
        items = [];
        $('historyList').innerHTML = '';
        $('historyResult').hidden = true;
        $('historyFile').value = '';
        setError('');
        setStatus('');
        $('historyPanel').hidden = true;
        $('historyDrop').hidden = false;
    }

    function loadFile(file) {
        setError('');
        if (!file) return;
        if (!file.type.startsWith('image/')) { setError('Hãy chọn một file ảnh.'); return; }
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            img = image;
            drawPreview(image, 'historyPreview');
            URL.revokeObjectURL(url);
            $('historyResult').hidden = true;
            $('historyDrop').hidden = true;
            $('historyPanel').hidden = false;
            setStatus('Đã nhận ảnh. Đối chiếu ảnh với danh sách sau khi đọc, rồi bấm Đọc lịch sử.');
        };
        image.onerror = () => { URL.revokeObjectURL(url); setError('Không mở được ảnh này.'); };
        image.src = url;
    }

    function prepareImage() {
        return prepareOcrCanvas(img, { minWidth: HISTORY_MIN_WIDTH, maxScale: 2.5 });
    }

    function renderList() {
        const wallets = getWallets();
        const walletOptions = (selected) => wallets
            .map((w) => `<option value="${escapeHtml(w.id)}" ${w.id === selected ? 'selected' : ''}>${escapeHtml(w.name)}</option>`)
            .join('');
        $('historyList').innerHTML = items.map((it, i) => {
            const cats = getCategoriesFor(it.type);
            return `
            <li class="history-import__item">
                <input type="checkbox" class="history-import__check" data-i="${i}" data-field="checked" ${it.checked ? 'checked' : ''} aria-label="Thêm giao dịch này">
                <input type="date" class="form-input" data-i="${i}" data-field="date" value="${it.date || ''}" aria-label="Ngày">
                <input type="text" class="form-input history-import__desc" data-i="${i}" data-field="description" maxlength="100" value="${escapeHtml(it.description)}" aria-label="Nội dung">
                <input type="text" inputmode="numeric" class="form-input history-import__amount" data-i="${i}" data-field="amount" value="${it.amount}" aria-label="Số tiền">
                <select class="form-select" data-i="${i}" data-field="type" aria-label="Thu hoặc chi">
                    <option value="expense" ${it.type === 'expense' ? 'selected' : ''}>Chi</option>
                    <option value="income" ${it.type === 'income' ? 'selected' : ''}>Thu</option>
                </select>
                <select class="form-select" data-i="${i}" data-field="category" aria-label="Danh mục">
                    ${cats.map((c) => `<option value="${escapeHtml(c)}" ${c === it.category ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                </select>
                <select class="form-select" data-i="${i}" data-field="walletId" aria-label="Ví">${walletOptions(it.walletId)}</select>
            </li>`;
        }).join('');
        updateCount();
    }

    function updateCount() {
        const n = items.filter((it) => it.checked && it.amount > 0 && it.date).length;
        $('historyConfirmBtn').textContent = `Thêm ${n} giao dịch`;
        $('historyConfirmBtn').disabled = n === 0;
    }

    async function readHistory() {
        if (busy) return;
        if (!img) { setError('Hãy dán hoặc chọn ảnh trước.'); return; }
        if (typeof Tesseract === 'undefined') {
            setError('Chưa tải được bộ đọc chữ. Kiểm tra kết nối mạng và thử lại.');
            return;
        }
        busy = true;
        const btn = $('historyReadBtn');
        btn.disabled = true;
        btn.textContent = 'Đang đọc...';
        setError('');
        try {
            const text = await runTesseract(prepareImage(), { psm: 6 });
            const rows = parseBankHistory(text);
            if (rows.length === 0) {
                setError('Không tìm thấy giao dịch nào. Thử ảnh rõ hơn, và chụp đủ các dòng có ngày.');
                $('historyResult').hidden = true;
                return;
            }
            items = rows.map((r) => {
                const type = r.type || 'expense';
                return {
                    checked: true,
                    date: r.date,
                    description: r.description,
                    amount: r.amount,
                    type,
                    category: guessCategory(r.description, type),
                    walletId: DEFAULT_WALLET_ID,
                    manual: false,
                };
            });
            renderList();
            $('historyResult').hidden = false;
            const unsure = rows.filter((r) => !r.type).length;
            setStatus(unsure
                ? `Đọc được ${rows.length} giao dịch. ${unsure} khoản không có dấu +/- nên được đặt là Chi, hãy kiểm tra lại.`
                : `Đọc được ${rows.length} giao dịch. Kiểm tra trước khi thêm.`);
        } catch (err) {
            setError('Đọc ảnh bị lỗi. Thử lại hoặc nhập tay.');
        } finally {
            busy = false;
            btn.disabled = false;
            btn.textContent = 'Đọc lịch sử';
        }
    }

    // Ghi các khoản đã tick vào danh sách. Chỉ chạy khi người dùng bấm xác nhận.
    function confirmImport() {
        const picked = items.filter((it) => it.checked && it.amount > 0 && it.date);
        if (picked.length === 0) return;
        let saved = 0;
        picked.forEach((it) => {
            const tx = addTransaction({
                title: it.description || 'Giao dịch',
                amount: it.amount,
                type: it.type,
                category: it.category,
                date: it.date,
                status: 'completed',
                walletId: it.walletId,
            });
            if (tx) saved += 1;
        });
        resetPanel();
        refresh();
        if (saved === picked.length) {
            showToast(`Đã thêm ${saved} giao dịch từ ảnh lịch sử`, 'success', 5000);
        } else {
            showToast(`Chỉ thêm được ${saved}/${picked.length} giao dịch. Bộ nhớ có thể đã đầy.`, 'danger', 6000);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!$('historyDrop')) return;
        $('historyPickBtn').addEventListener('click', (e) => { e.stopPropagation(); $('historyFile').click(); });
        $('historyFile').addEventListener('change', (e) => loadFile(e.target.files[0]));
        $('historyReadBtn').addEventListener('click', readHistory);
        $('historyCancelBtn').addEventListener('click', resetPanel);
        $('historyConfirmBtn').addEventListener('click', confirmImport);

        const onEdit = (e) => {
            const i = Number(e.target.dataset.i);
            if (Number.isNaN(i) || !items[i]) return;
            const field = e.target.dataset.field;
            const it = items[i];
            if (field === 'checked') it.checked = e.target.checked;
            if (field === 'date') it.date = e.target.value;
            if (field === 'description') it.description = e.target.value;
            if (field === 'amount') {
                it.amount = Number(e.target.value.replace(/\D/g, '')) || 0;
                e.target.value = e.target.value.replace(/\D/g, '');
            }
            if (field === 'walletId') it.walletId = e.target.value;
            if (field === 'category') {
                it.category = e.target.value;
                it.manual = true;
                const key = memoryKey(it.description);
                saveCategoryMemory(key, it.category);
                // Áp dụng cho các dòng cùng đối tác mà bạn chưa tự chọn.
                items.forEach((other) => {
                    if (other !== it && !other.manual && memoryKey(other.description) === key
                        && getCategoriesFor(other.type).includes(it.category)) {
                        other.category = it.category;
                    }
                });
                renderList();
                return;
            }
            if (field === 'type') {
                it.type = e.target.value;
                it.category = guessCategory(it.description, it.type);
                renderList();
                return;
            }
            updateCount();
        };
        $('historyList').addEventListener('input', onEdit);
        $('historyList').addEventListener('change', onEdit);

        const drop = $('historyDrop');
        drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
        drop.addEventListener('drop', (e) => {
            e.preventDefault();
            drop.classList.remove('is-over');
            loadFile(e.dataTransfer.files[0]);
        });

        // Ctrl+V nhận ảnh khi khung nhập lịch sử đang hiện và không có hộp thoại nào mở.
        // Không kiểm tra ô đang focus: ô nhập chỉ nhận chữ, nên ảnh luôn đi tới đây.
        document.addEventListener('paste', (e) => {
            if (document.querySelector('.modal.active')) return;
            if (!$('historyDrop').offsetParent) return;
            const dataItems = e.clipboardData && e.clipboardData.items;
            if (!dataItems) return;
            for (const item of dataItems) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    resetPanel();
                    loadFile(item.getAsFile());
                    return;
                }
            }
        });
    });
})();
