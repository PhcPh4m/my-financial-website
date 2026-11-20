// Nhập và xuất dữ liệu: CSV ẩn danh một bảng để phân tích, JSON sao lưu (nhập được), và chống trùng khi nhập.
// Tách khỏi storage.js để file đó chỉ còn lưu và đọc dữ liệu. Phải nạp sau storage.js.

// Tên các cột trong file CSV, giống hàng tiêu đề của bảng tính Excel.
// Một bảng duy nhất, lọc theo cột loai_dong: giao_dich, so_du_vi, chuyen_tien, khoan_vay.
const CSV_HEADERS = ['loai_dong', 'title', 'amount', 'type', 'category', 'status', 'date', 'wallet', 'so_du_dau', 'so_du_hien_tai', 'chuyen_tu', 'chuyen_den', 'so_ky', 'tien_moi_ky', 'ky_da_tra'];
const CSV_ROW_TRANSACTION = 'giao_dich';
const CSV_ROW_WALLET = 'so_du_vi';
const CSV_ROW_TRANSFER = 'chuyen_tien';
const CSV_ROW_LOAN = 'khoan_vay';

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
    // id trong file -> id trong trình duyệt này (giao dịch mới hoặc giao dịch trùng đã có), để nối lại khoản vay.
    const idByKey = new Map(existing.map((t) => [transactionKey(t), t.id]));
    const idMap = new Map();
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
            if (raw && raw.id != null) idMap.set(String(raw.id), idByKey.get(key));
            return;
        }
        seen.add(key);
        const tx = { ...normalized, id: nextId(all), createdDate: nowText() };
        all.push(tx);
        added.push(tx);
        idByKey.set(key, tx.id);
        if (raw && raw.id != null) idMap.set(String(raw.id), tx.id);
    });

    if (added.length > 0 && !saveTransactions([...existing, ...added])) {
        throw new Error('Không lưu được dữ liệu nhập vào trình duyệt (bộ nhớ có thể đã đầy).');
    }
    return { added: added.length, skipped, duplicates, idMap };
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
            version: 5,
            exportedAt: new Date().toISOString(),
            wallets: getWallets(),
            walletTransfers: readWalletTransfers(),
            budget: getBudget(),
            categoryBudgets: getCategoryBudgets(),
            recurringRules: getRecurringRules(),
            installmentLoans: readLoans(),
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

// MÃ NGƯỜI NHẬN ẨN DANH
// Người nhận có cờ personTransfer được đánh mã theo thứ tự ngày giao dịch đầu tiên:
// A, B, ..., Z, AA, AB, ... Mỗi người có dãy số riêng: A-001, A-002, B-001.
// Mã chỉ tạo khi xuất, không lưu vào dữ liệu.
function letterCode(index) {
    let n = index + 1;
    let s = '';
    while (n > 0) {
        n--;
        s = String.fromCharCode(65 + (n % 26)) + s;
        n = Math.floor(n / 26);
    }
    return s;
}

function recipientKeyOf(name) {
    return String(name ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

// Trả về: codeOf (id giao dịch -> mã). Mã chỉ dùng trong một lần xuất, không lưu.
function buildRecipientCodes(transactions) {
    const people = [];          // { key, name, letter, count }
    const byKey = new Map();
    const codeOf = new Map();
    const ordered = transactions
        .filter((t) => t.personTransfer === true)
        .slice()
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id < b.id ? -1 : 1)));
    ordered.forEach((t) => {
        const key = recipientKeyOf(t.recipient);
        let person = byKey.get(key);
        if (!person) {
            person = { key, name: String(t.recipient ?? '').trim(), letter: letterCode(people.length), count: 0 };
            byKey.set(key, person);
            people.push(person);
        }
        person.count++;
        codeOf.set(t.id, `${person.letter}-${String(person.count).padStart(3, '0')}`);
    });
    return { codeOf };
}

// Tiêu đề khi xuất: người nhận có cờ thành "Chuyển cho [mã]". Khoản "Thanh toán cho ..." chưa có cờ
// có thể chứa tên người, nên che đi để không lộ khi xuất (an toàn mặc định).
function titleForExport(t, codeOf) {
    if (codeOf.has(t.id)) return `Chuyển cho ${codeOf.get(t.id)}`;
    if (/^Thanh toán cho\b/i.test(String(t.title ?? ''))) return 'Thanh toán cho [đã che]';
    return t.title;
}

// Xuất dữ liệu thành file CSV, mở được bằng Excel. Người nhận có cờ được thay bằng mã.
function exportAsCSV() {
    const transactions = getTransactions();
    const { codeOf } = buildRecipientCodes(transactions);
    const rows = [CSV_HEADERS.join(',')];
    const pushRow = (values) => {
        const row = CSV_HEADERS.map((h) => values[h] ?? '');
        rows.push(row.map((v) => csvEscape(v)).join(','));
    };
    // Giao dịch
    transactions.forEach((t) => pushRow({
        loai_dong: CSV_ROW_TRANSACTION,
        title: titleForExport(t, codeOf),
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
    // Khoản trả góp: tên bên cho vay, số tiền vay, số kỳ, số tiền mỗi kỳ, số kỳ đã tick và trạng thái
    readLoans().forEach((l) => pushRow({
        loai_dong: CSV_ROW_LOAN,
        title: l.lenderName,
        amount: l.principal,
        status: l.settledTxId ? 'tat_toan' : 'dang_tra',
        date: l.firstDue,
        so_ky: l.months,
        tien_moi_ky: l.payment,
        ky_da_tra: l.paidIds.length
    }));
    return '\uFEFF' + rows.join('\r\n');
}

// IMPORT

// Nhập dữ liệu từ file JSON sao lưu: thêm dòng đúng, bỏ dòng sai và dòng đã có, rồi báo số dòng.
// File CSV không nhập lại được: đã ẩn danh nên không khôi phục đủ dữ liệu.
function importTransactions(text) {
    const clean = text.replace(/^\uFEFF/, '');
    let data;
    try {
        data = JSON.parse(clean);
    } catch (e) {
        throw new Error('Chỉ nhập được file JSON sao lưu. File CSV đã ẩn danh không nhập lại được.');
    }
    if (!data || !Array.isArray(data.transactions)) {
        throw new Error('File JSON không đúng định dạng (thiếu mảng "transactions").');
    }
    const candidates = data.transactions;

    // Khôi phục ví và chuyển tiền trước để giao dịch trong file tìm đúng ví (thêm vào, không ghi đè).
    if (Array.isArray(data.wallets)) {
        const haveW = new Set(getWallets().map((w) => w.id));
        const extraW = data.wallets.filter((w) => isValidWallet(w) && !haveW.has(w.id));
        if (extraW.length) saveWallets([...getWallets(), ...extraW]);
    }
    if (Array.isArray(data.walletTransfers)) {
        const haveT = new Set(readWalletTransfers().map((t) => t.id));
        const known = new Set(getWallets().map((w) => w.id));
        const extraT = data.walletTransfers.filter((t) =>
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

    // Khoản trả góp: thêm những khoản chưa có, nối lại kỳ đã trả và giao dịch tất toán theo id mới.
    if (Array.isArray(data.installmentLoans)) {
        const have = new Set(readLoans().map((l) => l.id));
        const remap = (id) => (id == null ? null : (result.idMap.get(String(id)) ?? null));
        const extra = data.installmentLoans
            .filter((l) => isValidLoan(l) && !have.has(l.id))
            .map((l) => {
                const copy = { ...l, paidIds: l.paidIds.map(remap).filter(Boolean) };
                const settled = remap(l.settledTxId);
                if (settled) copy.settledTxId = settled; else delete copy.settledTxId;
                return copy;
            });
        if (extra.length) saveLoans([...readLoans(), ...extra]);
    }

    // Ngân sách tháng: chỉ đặt khi máy này chưa có ngân sách, không ghi đè.
    if (typeof data.budget === 'number' && data.budget > 0 && getBudget() === null) setBudget(data.budget);

    // Bản sao lưu v3 có thêm ngân sách danh mục và giao dịch định kỳ. Khôi phục theo kiểu thêm vào, không ghi đè.
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

    return { imported: result.added, skipped: skipped + result.skipped, duplicates: result.duplicates };
}

