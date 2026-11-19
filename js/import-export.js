// Nhập và xuất dữ liệu: CSV một bảng, JSON sao lưu, và chống trùng khi nhập.
// Tách khỏi storage.js để file đó chỉ còn lưu và đọc dữ liệu. Phải nạp sau storage.js.

// Tên các cột trong file CSV, giống hàng tiêu đề của bảng tính Excel.
// Một bảng duy nhất, lọc theo cột loai_dong: giao_dich, so_du_vi, chuyen_tien.
// Các cột cũ giữ nguyên tên để file cũ vẫn nhập được.
const CSV_HEADERS = ['loai_dong', 'title', 'amount', 'type', 'category', 'status', 'date', 'wallet', 'so_du_dau', 'so_du_hien_tai', 'chuyen_tu', 'chuyen_den'];
const CSV_ROW_TRANSACTION = 'giao_dich';
const CSV_ROW_WALLET = 'so_du_vi';
const CSV_ROW_TRANSFER = 'chuyen_tien';

// CHỐNG TRÙNG
// Một giao dịch được coi là trùng khi cùng ngày, cùng số tiền và cùng loại thu/chi
// (quy tắc A). Tên, danh mục và ví không được so khớp, vì OCR hay đọc lệch chữ.
function transactionKey(t) {
    return [t.date, Number(t.amount), t.type].join('|');
}

// Ghi các giao dịch mới, bỏ qua giao dịch đã có hoặc trùng ngay trong cùng lô.
// Trả về số đã thêm, số dòng không hợp lệ, và số dòng bị bỏ vì đã có.
function commitTransactions(candidates) {
    const existing = getTransactions();
    const all = existing.slice();
    const added = [];
    const seen = new Set(existing.map(transactionKey));
    let skipped = 0;
    let duplicates = 0;

    (candidates || []).forEach((raw) => {
        const normalized = normalizeTransaction({ ...(raw || {}), walletId: resolveWalletId(raw) });
        if (!validateTransaction(normalized).isValid) {
            skipped++;
            return;
        }
        const key = transactionKey(normalized);
        if (seen.has(key)) {
            duplicates++;
            return;
        }
        seen.add(key);
        const tx = { ...normalized, id: nextId(all), createdDate: nowText() };
        all.push(tx);
        added.push(tx);
    });

    if (added.length > 0 && !saveTransactions([...existing, ...added])) {
        throw new Error('Không lưu được dữ liệu nhập vào trình duyệt (bộ nhớ có thể đã đầy).');
    }
    return { added: added.length, skipped, duplicates };
}

// Kiểm tra một khoản (dạng dữ liệu thô, chưa lưu) đã có trong danh sách hay chưa.
function isAlreadySaved(raw) {
    const key = transactionKey({ date: raw.date, amount: Number(raw.amount), type: raw.type });
    return getTransactions().some((t) => transactionKey(t) === key);
}

// EXPORT

// Xuất toàn bộ dữ liệu thành file JSON để sao lưu.
function exportAsJSON() {
    return JSON.stringify(
        {
            app: 'web-quan-ly-tai-chinh-ca-nhan',
            version: 4,
            exportedAt: new Date().toISOString(),
            wallets: getWallets(),
            walletTransfers: readWalletTransfers(),
            budget: getBudget(),
            categoryBudgets: getCategoryBudgets(),
            recurringRules: getRecurringRules(),
            transactions: getTransactions()
        },
        null,
        2
    );
}

// Bọc một ô trong dấu ngoặc kép nếu nội dung có dấu phẩy, để file CSV không bị lệch cột.
function csvEscape(value) {
    // Số (kể cả số âm như số dư ví âm) giữ nguyên, không thêm dấu ' để Excel vẫn hiểu là số.
    if (typeof value === 'number') return String(value);
    let s = String(value ?? '');
    // Ô bắt đầu bằng = + - @ sẽ thành công thức khi mở bằng Excel. Thêm dấu ' phía trước để Excel coi là chữ.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Gỡ dấu ' mà exportAsCSV đã thêm, để dữ liệu nhập lại đúng như ban đầu.
function unescapeCsvFormula(value) {
    const s = String(value ?? '');
    return /^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s;
}

// Xuất dữ liệu thành file CSV, mở được bằng Excel.
function exportAsCSV() {
    const rows = [CSV_HEADERS.join(',')];
    const pushRow = (values) => {
        const row = CSV_HEADERS.map((h) => values[h] ?? '');
        rows.push(row.map((v) => csvEscape(v)).join(','));
    };
    // Giao dịch
    getTransactions().forEach((t) => pushRow({
        loai_dong: CSV_ROW_TRANSACTION,
        title: t.title,
        amount: t.amount,
        type: t.type,
        category: t.category,
        status: t.status,
        date: t.date,
        wallet: walletNameOf(t.walletId)
    }));
    // Số dư từng ví (số dư đầu và số dư hiện tại)
    getWalletBalances().forEach((w) => pushRow({
        loai_dong: CSV_ROW_WALLET,
        title: w.name,
        wallet: w.name,
        so_du_dau: w.openingBalance,
        so_du_hien_tai: w.balance
    }));
    // Chuyển tiền giữa các ví (không tính là thu hay chi)
    readWalletTransfers().forEach((tr) => pushRow({
        loai_dong: CSV_ROW_TRANSFER,
        title: 'Chuyển tiền',
        amount: tr.amount,
        date: tr.date,
        chuyen_tu: walletNameOf(tr.from),
        chuyen_den: walletNameOf(tr.to)
    }));
    return '\uFEFF' + rows.join('\r\n');
}

// IMPORT

// Đọc file CSV, tách từng dòng và từng ô.
function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else {
                field += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ',') {
            row.push(field);
            field = '';
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += c;
        }
    }
    if (field.length || row.length) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// Đổi các dòng CSV đã đọc thành danh sách giao dịch.
function rowsToTransactions(rows) {
    if (rows.length < 2) return [];
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const indexOf = (name) => headers.indexOf(name);

    return rows.slice(1).filter((cells) => {
        // Chỉ nhập dòng giao dịch. Dòng số dư ví và chuyển tiền chỉ để xem, không nhập lại.
        // File cũ không có cột loai_dong thì mọi dòng đều là giao dịch.
        const kind = indexOf('loai_dong') >= 0 ? (cells[indexOf('loai_dong')] ?? '').trim().toLowerCase() : '';
        return kind === '' || kind === CSV_ROW_TRANSACTION;
    }).map((cells) => {
        const get = (name) => (indexOf(name) >= 0 ? cells[indexOf(name)] ?? '' : '');
        return {
            title: unescapeCsvFormula(get('title')),
            amount: get('amount'),
            type: get('type').trim().toLowerCase(),
            category: unescapeCsvFormula(get('category')),
            status: get('status').trim().toLowerCase(),
            date: get('date').trim(),
            wallet: unescapeCsvFormula(get('wallet'))
        };
    });
}

// Nhập dữ liệu từ file JSON hoặc CSV: thêm dòng đúng, bỏ dòng sai và dòng đã có, rồi báo số dòng.
function importTransactions(text, format) {
    const clean = text.replace(/^\uFEFF/, '');
    let candidates;

    if (format === 'json') {
        const data = JSON.parse(clean);
        if (!data || !Array.isArray(data.transactions)) {
            throw new Error('File JSON không đúng định dạng (thiếu mảng "transactions").');
        }
        candidates = data.transactions;
    } else {
        // Phân tích nội dung CSV thành các dòng, rồi đổi mỗi dòng thành giao dịch.
        candidates = rowsToTransactions(parseCSV(clean));
        if (candidates.length === 0) {
            throw new Error('File CSV trống hoặc thiếu dòng tiêu đề.');
        }
    }

    // Khôi phục ví và chuyển tiền trước để giao dịch trong file tìm đúng ví (thêm vào, không ghi đè).
    if (format === 'json' && Array.isArray(JSON.parse(clean).wallets)) {
        const haveW = new Set(getWallets().map((w) => w.id));
        const extraW = JSON.parse(clean).wallets.filter((w) => isValidWallet(w) && !haveW.has(w.id));
        if (extraW.length) saveWallets([...getWallets(), ...extraW]);
    }
    if (format === 'json' && Array.isArray(JSON.parse(clean).walletTransfers)) {
        const haveT = new Set(readWalletTransfers().map((t) => t.id));
        const known = new Set(getWallets().map((w) => w.id));
        const extraT = JSON.parse(clean).walletTransfers.filter((t) =>
            isValidWalletTransfer(t) && !haveT.has(t.id) && known.has(t.from) && known.has(t.to) && t.from !== t.to);
        if (extraT.length) saveWalletTransfers([...readWalletTransfers(), ...extraT]);
    }

    // Số gốc không hợp lệ, ví dụ 45000,4, phải bị bỏ trước khi làm tròn.
    let skipped = 0;
    const checked = [];
    candidates.forEach((raw) => {
        const hasAmount = raw && raw.amount !== '' && raw.amount !== undefined && raw.amount !== null;
        if (hasAmount && !Number.isInteger(Number(raw.amount))) {
            skipped++;
            return;
        }
        checked.push(raw);
    });

    const result = commitTransactions(checked);

    // Bản sao lưu v3 có thêm ngân sách danh mục và giao dịch định kỳ. Khôi phục theo kiểu thêm vào, không ghi đè.
    if (format === 'json') {
        const data = JSON.parse(clean);
        if (data.categoryBudgets && typeof data.categoryBudgets === 'object') {
            Object.entries(data.categoryBudgets).forEach(([name, value]) => {
                if (EXPENSE_CATEGORIES.includes(name) || INCOME_CATEGORIES.includes(name)) setCategoryBudget(name, value);
            });
        }
        if (Array.isArray(data.recurringRules)) {
            const have = new Set(getRecurringRules().map((r) => r.id));
            const extra = data.recurringRules.filter((r) => isValidRecurringRule(r) && !have.has(r.id));
            if (extra.length) saveRecurringRules([...getRecurringRules(), ...extra]);
        }
    }
    return { imported: result.added, skipped: skipped + result.skipped, duplicates: result.duplicates };
}

